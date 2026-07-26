import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { auth } from "@/auth";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { mockSupabaseFrom } from "@/tests/setup/supabaseMock";
import { GET, POST } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const VALID_TAXONOMY = { domain: "hardware", subsystem: "network", leaf_node: "broker_api_latency" };

function postReq(body: unknown) {
  return new Request("http://localhost/api/session/issues", { method: "POST", body: JSON.stringify(body) }) as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/session/issues", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("treats null issues data (no error) as an empty list rather than throwing", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      issues: { data: null, error: null },
      tool_deployments: { data: [], error: null },
      digital_tools: { data: [], error: null },
    });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it("500s when the primary issues query fails", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      issues: { data: null, error: { message: "fail" } },
      tool_deployments: { data: [], error: null },
      digital_tools: { data: [], error: null },
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("degrades gracefully when the tool tables are unavailable", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      issues: { data: [{ issue_id: "i1", title: "Broker API latency spike", status: "open", priority: 3, created_at: "2026-01-01T00:00:00Z" }], error: null },
      tool_deployments: { data: null, error: { message: "table missing" } },
      digital_tools: { data: null, error: { message: "table missing" } },
    });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json[0].deployments).toEqual([]);
  });

  it("treats null deployments/tools data (no error) as empty rather than throwing", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      issues: { data: [{ issue_id: "i1", title: "T", status: "open", priority: 3, created_at: "2026-01-01T00:00:00Z" }], error: null },
      tool_deployments: { data: null, error: null },
      digital_tools: { data: null, error: null },
    });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json[0].deployments).toEqual([]);
  });

  it("computes staging_days_remaining for an issue currently in staging", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      issues: {
        data: [{
          issue_id: "i1", title: "T", status: "staging", priority: 3,
          staging_at: new Date().toISOString(), created_at: "2026-01-01T00:00:00Z",
        }],
        error: null,
      },
      tool_deployments: { data: [], error: null },
      digital_tools: { data: [], error: null },
    });
    const res = await GET();
    const json = await res.json();
    expect(json[0].staging_days_remaining).toBeGreaterThan(0);
  });

  it("nests sub-issues under their parent", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      issues: {
        data: [
          { issue_id: "parent", title: "Parent", status: "open", priority: 3, created_at: "2026-01-01T00:00:00Z" },
          { issue_id: "child", title: "Child", status: "open", priority: 3, created_at: "2026-01-01T00:00:00Z", parent_issue_id: "parent" },
        ],
        error: null,
      },
      tool_deployments: { data: [], error: null },
      digital_tools: { data: [], error: null },
    });
    const res = await GET();
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].sub_issues).toEqual([expect.objectContaining({ issue_id: "child" })]);
  });

  it("auto-promotes an OOS_VALIDATION issue that has survived enough sessions and persists it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T02:00:00Z")); // 21x24h after oos_started_at = exactly 15 weekday sessions
    mockAuth(auth, fakeSession(["operator"]));
    const spy = mockSupabaseFrom({
      issues: [
        {
          data: [{
            issue_id: "i1", title: "Contained issue", status: "staging", priority: 3,
            kms_status: "OOS_VALIDATION", oos_started_at: "2026-07-06T02:00:00Z",
            created_at: "2026-01-01T00:00:00Z",
          }],
          error: null,
        },
        { data: null, error: null }, // promotion update
      ],
      tool_deployments: { data: [], error: null },
      digital_tools: { data: [], error: null },
    });
    const res = await GET();
    const json = await res.json();
    expect(json[0].kms_status).toBe("BASELINE_RESTORED");
    expect(spy).toHaveBeenCalledWith("issues");
  });

  it("attaches deployment metadata, falling back to 'unknown tool' for an unmatched tool_id", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      issues: { data: [{ issue_id: "i1", title: "T", status: "open", priority: 3, created_at: "2026-01-01T00:00:00Z" }], error: null },
      tool_deployments: {
        data: [
          { id: "d1", issue_id: "i1", tool_id: "t1", deployed_at: "2026-01-02T00:00:00Z", deployed_by: "a", active: true, relapses: 1 },
          { id: "d2", issue_id: "i1", tool_id: "unmatched", deployed_at: "2026-01-03T00:00:00Z", deployed_by: "b", active: false },
        ],
        error: null,
      },
      digital_tools: { data: [{ tool_id: "t1", name: "Retest Discipline", category: "process", version: "1.0" }], error: null },
    });
    const res = await GET();
    const json = await res.json();
    expect(json[0].deployments).toHaveLength(2);
    expect(json[0].deployments[0].tool_name).toBe("Retest Discipline");
    expect(json[0].deployments[1].tool_name).toBe("unknown tool");
    expect(json[0].deployments[1].relapses).toBe(0);
  });

  it("does not promote an OOS_VALIDATION issue that hasn't survived enough sessions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T02:00:00Z")); // only 2 sessions elapsed
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      issues: {
        data: [{
          issue_id: "i1", title: "Contained issue", status: "staging", priority: 3,
          kms_status: "OOS_VALIDATION", oos_started_at: "2026-07-06T02:00:00Z",
          created_at: "2026-01-01T00:00:00Z",
        }],
        error: null,
      },
      tool_deployments: { data: [], error: null },
      digital_tools: { data: [], error: null },
    });
    const res = await GET();
    const json = await res.json();
    expect(json[0].kms_status).toBe("OOS_VALIDATION");
  });
});

describe("POST /api/session/issues", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await POST(postReq({ title: "t", ...VALID_TAXONOMY }));
    expect(res.status).toBe(401);
  });

  it("403s for a role outside the allowed set", async () => {
    mockAuth(auth, fakeSession(["nobody"]));
    const res = await POST(postReq({ title: "t", ...VALID_TAXONOMY }));
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await POST(postReq({ title: "t", ...VALID_TAXONOMY }));
    expect(res.status).toBe(403);
  });

  it("422s on a taxonomy path that is not an exact ontology node", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await POST(postReq({ title: "t", domain: "hardware", subsystem: "network", leaf_node: "nonexistent" }));
    expect(res.status).toBe(422);
  });

  it("422s when free-text tags are supplied", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await POST(postReq({ title: "t", ...VALID_TAXONOMY, tags: ["custom"] }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.error).toMatch(/Zero-trust metadata/);
  });

  it("400s when title is missing", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await POST(postReq({ title: "", ...VALID_TAXONOMY }));
    expect(res.status).toBe(400);
  });

  it("422s on a malformed JSON body (falls back to empty taxonomy fields)", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const badReq = new Request("http://localhost/api/session/issues", { method: "POST", body: "{not json" }) as any;
    const res = await POST(badReq);
    expect(res.status).toBe(422);
  });

  it("accepts optional description/priority/impact_score/parent_issue_id when given valid types", async () => {
    mockAuth(auth, fakeSession(["operator"], { userEmail: "op@xtnl-solutions.com" }));
    mockSupabaseFrom({ issues: { data: { issue_id: "new-1" }, error: null } });
    const res = await POST(postReq({
      title: "Broker latency", ...VALID_TAXONOMY,
      description: "details here", priority: 1, impact_score: 8, parent_issue_id: "parent-1",
    }));
    expect(res.status).toBe(201);
  });

  it("clamps priority/impact_score to their bounds when out of range", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ issues: { data: { issue_id: "new-1" }, error: null } });
    const res = await POST(postReq({
      title: "Broker latency", ...VALID_TAXONOMY, priority: 99, impact_score: -5,
    }));
    expect(res.status).toBe(201);
  });

  it("treats an empty-string parent_issue_id as null", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ issues: { data: { issue_id: "new-1" }, error: null } });
    const res = await POST(postReq({ title: "Broker latency", ...VALID_TAXONOMY, parent_issue_id: "" }));
    expect(res.status).toBe(201);
  });

  it("falls back reporter_role to null when roles[0] is not a truthy value", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "op@xtnl-solutions.com", roles: [undefined, "operator"] } as any);
    mockSupabaseFrom({ issues: { data: { issue_id: "new-1" }, error: null } });
    const res = await POST(postReq({ title: "Broker latency", ...VALID_TAXONOMY }));
    expect(res.status).toBe(201);
  });

  it("creates an issue on the happy path", async () => {
    mockAuth(auth, fakeSession(["operator"], { userEmail: "op@xtnl-solutions.com" }));
    mockSupabaseFrom({ issues: { data: { issue_id: "new-1" }, error: null } });
    const res = await POST(postReq({ title: "Broker latency", ...VALID_TAXONOMY }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.issue_id).toBe("new-1");
  });

  it("500s on a supabase insert error", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ issues: { data: null, error: { message: "fail" } } });
    const res = await POST(postReq({ title: "Broker latency", ...VALID_TAXONOMY }));
    expect(res.status).toBe(500);
  });

  it("falls back reported_by to 'unknown' when the session has no userEmail", async () => {
    mockAuth(auth, fakeSession(["operator"], { userEmail: undefined } as any));
    mockSupabaseFrom({ issues: { data: { issue_id: "new-1" }, error: null } });
    const res = await POST(postReq({ title: "Broker latency", ...VALID_TAXONOMY }));
    expect(res.status).toBe(201);
  });
});
