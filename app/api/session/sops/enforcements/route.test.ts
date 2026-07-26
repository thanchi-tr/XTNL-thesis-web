import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { mockSupabaseFrom } from "@/tests/setup/supabaseMock";
import { getMondayAESTKeyWeeksAgo } from "@/lib/weekKey";
import { GET, POST } from "./route";

function throwingSupabase() {
  return vi.spyOn(supabase, "from").mockImplementation(() => { throw new Error("boom"); });
}

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function postReq(body: unknown) {
  return new Request("http://localhost/api/session/sops/enforcements", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/session/sops/enforcements", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns an empty set when no enforcement batch has ever been submitted", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ sop_enforcements: { data: null, error: null } });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ weekKey: null, sops: [] });
  });

  it("returns the most recently submitted batch regardless of whether it is 'this' or 'next' week", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      sop_enforcements: [
        { data: { week_key: "2026-04-20" }, error: null }, // latest lookup
        {
          data: [
            { sop_id: 1, sop_checklists: { id: 1, title: "Entry" } },
            { sop_id: 2, sop_checklists: [{ id: 2, title: "Risk" }] }, // some supabase joins return arrays
          ],
          error: null,
        },
      ],
    });
    const res = await GET();
    const json = await res.json();
    expect(json.weekKey).toBe("2026-04-20");
    expect(json.sops).toEqual([{ id: 1, title: "Entry" }, { id: 2, title: "Risk" }]);
  });

  it("500s when the latest-week lookup fails", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ sop_enforcements: { data: null, error: { message: "fail" } } });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("treats a null joined-rows result as an empty list", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      sop_enforcements: [
        { data: { week_key: "2026-04-20" }, error: null },
        { data: null, error: null },
      ],
    });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.sops).toEqual([]);
  });

  it("500s when the row fetch for the latest week fails", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      sop_enforcements: [
        { data: { week_key: "2026-04-20" }, error: null },
        { data: null, error: { message: "fail" } },
      ],
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("500s on an unexpected exception", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    throwingSupabase();
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/session/sops/enforcements", () => {
  const NOW = "2026-04-12T14:00:00Z"; // Monday 2026-04-13 00:00 AEST

  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await POST(postReq({ sopIds: [1] }));
    expect(res.status).toBe(401);
  });

  it("403s for a role outside strategist/fund_manager", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    const res = await POST(postReq({ sopIds: [1] }));
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await POST(postReq({ sopIds: [1] }));
    expect(res.status).toBe(403);
  });

  it("400s when sopIds is not an array", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const res = await POST(postReq({ sopIds: "1" }));
    expect(res.status).toBe(400);
  });

  it("400s on a malformed JSON body (parsed to null)", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const badReq = new Request("http://localhost/api/session/sops/enforcements", { method: "POST", body: "{not json" });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it("files the enforcement under next week's key, deduping and dropping invalid ids", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    const expectedWeekKey = getMondayAESTKeyWeeksAgo(-1);

    mockAuth(auth, fakeSession(["strategist"], { userEmail: "strat@xtnl-solutions.com" }));
    mockSupabaseFrom({
      sop_enforcements: [
        { data: null, error: null }, // delete
        { data: null, error: null }, // insert
      ],
      sop_checklists: { data: [{ id: 1, title: "Entry" }, { id: 2, title: "Risk" }], error: null },
      comments: { data: { id: 99 }, error: null },
    });

    const res = await POST(postReq({ sopIds: [1, 1, 2, -5, 1.5, "3"] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.weekKey).toBe(expectedWeekKey);
    expect(json.titles).toEqual(["Entry", "Risk"]);
  });

  it("clears the enforced set when sopIds is empty, logging a 'cleared' comment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    mockAuth(auth, fakeSession(["strategist"], { userEmail: "strat@xtnl-solutions.com" }));
    const commentsSpy = mockSupabaseFrom({
      sop_enforcements: { data: null, error: null },
      comments: { data: { id: 100 }, error: null },
    });

    const res = await POST(postReq({ sopIds: [] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.titles).toEqual([]);
    expect(commentsSpy).toHaveBeenCalledWith("comments");
  });

  it("500s when the delete-existing step fails", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ sop_enforcements: { data: null, error: { message: "fail" } } });
    const res = await POST(postReq({ sopIds: [1] }));
    expect(res.status).toBe(500);
  });

  it("500s when the SOP title lookup fails", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({
      sop_enforcements: [{ data: null, error: null }],
      sop_checklists: { data: null, error: { message: "fail" } },
    });
    const res = await POST(postReq({ sopIds: [1] }));
    expect(res.status).toBe(500);
  });

  it("500s when the insert step fails", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({
      sop_enforcements: [
        { data: null, error: null },
        { data: null, error: { message: "fail" } },
      ],
      sop_checklists: { data: [{ id: 1, title: "Entry" }], error: null },
    });
    const res = await POST(postReq({ sopIds: [1] }));
    expect(res.status).toBe(500);
  });

  it("tolerates a null sopRows result from the title lookup", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({
      sop_enforcements: [
        { data: null, error: null },
        { data: null, error: null },
      ],
      sop_checklists: { data: null, error: null },
      comments: { data: null, error: null },
    });
    const res = await POST(postReq({ sopIds: [1] }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.titles).toEqual([]);
  });

  it("500s on an unexpected exception", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    throwingSupabase();
    const res = await POST(postReq({ sopIds: [1] }));
    expect(res.status).toBe(500);
  });

  it("attaches OPERATOR_USER_ID to the audit comment when configured", async () => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_USER_ID", "operator-uuid-1");
    try {
      const freshAuthMod = await import("@/auth");
      vi.mocked(freshAuthMod.auth).mockResolvedValue(fakeSession(["strategist"]) as any);
      const { mockSupabaseFrom: freshMock } = await import("@/tests/setup/supabaseMock");
      freshMock({
        sop_enforcements: [{ data: null, error: null }, { data: null, error: null }],
        sop_checklists: { data: [{ id: 1, title: "Entry" }], error: null },
        comments: { data: { id: 1 }, error: null },
      });
      const { POST: freshPOST } = await import("./route");
      const res = await freshPOST(postReq({ sopIds: [1] }));
      expect(res.status).toBe(200);
    } finally {
      vi.resetModules();
    }
  });
});
