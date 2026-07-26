import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { mockSupabaseFrom } from "@/tests/setup/supabaseMock";
import { PUT, DELETE } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function ctx(issueId: string) {
  return { params: Promise.resolve({ issueId }) };
}
function putReq(body: unknown) {
  return new Request("http://localhost/api/session/issues/i1/solution", { method: "PUT", body: JSON.stringify(body) }) as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});

describe("PUT /api/session/issues/[issueId]/solution", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await PUT(putReq({ description: "fix it" }), ctx("i1"));
    expect(res.status).toBe(401);
  });

  it("403s for a role outside strategist/fund_manager", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await PUT(putReq({ description: "fix it" }), ctx("i1"));
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await PUT(putReq({ description: "fix it" }), ctx("i1"));
    expect(res.status).toBe(403);
  });

  it("400s when description is blank", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const res = await PUT(putReq({ description: "   " }), ctx("i1"));
    expect(res.status).toBe(400);
  });

  it("400s on a malformed JSON body (falls back to empty description)", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const badReq = new Request("http://localhost/api/session/issues/i1/solution", { method: "PUT", body: "{not json" }) as any;
    const res = await PUT(badReq, ctx("i1"));
    expect(res.status).toBe(400);
  });

  it("404s when the issue does not exist", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ issues: { data: null, error: null } });
    const res = await PUT(putReq({ description: "fix it" }), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("404s and logs when the issue fetch itself errors", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ issues: { data: null, error: { message: "db down" } } });
    const res = await PUT(putReq({ description: "fix it" }), ctx("i1"));
    expect(res.status).toBe(404);
  });

  it("treats a null solutions column as an empty array", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({
      issues: [
        { data: { solutions: null, status: "open" }, error: null },
        { data: null, error: null },
      ],
      issue_events: { data: null, error: null },
    });
    const res = await PUT(putReq({ description: "first plan" }), ctx("i1"));
    expect(res.status).toBe(200);
  });

  it("scratches the existing active solution and appends the new one, flipping open->in_progress", async () => {
    mockAuth(auth, fakeSession(["strategist"], { userEmail: "s@xtnl-solutions.com" }));
    mockSupabaseFrom({
      issues: [
        { data: { solutions: [{ id: "old", status: "active" }], status: "open" }, error: null },
        { data: null, error: null }, // update
      ],
      issue_events: [
        { data: null, error: null }, // SOLUTION_SCRATCHED
        { data: null, error: null }, // SOLUTION_PROPOSED
      ],
    });
    const res = await PUT(putReq({ description: "New plan" }), ctx("i1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.solution_id).toBeTruthy();
  });

  it("falls back proposed_by to 'unknown' when the session has no userEmail", async () => {
    mockAuth(auth, fakeSession(["strategist"], { userEmail: undefined } as any));
    mockSupabaseFrom({
      issues: [
        { data: { solutions: [], status: "open" }, error: null },
        { data: null, error: null },
      ],
      issue_events: { data: null, error: null },
    });
    const res = await PUT(putReq({ description: "plan" }), ctx("i1"));
    expect(res.status).toBe(200);
  });

  it("does not log a SOLUTION_SCRATCHED event when there is no existing active solution", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const spy = mockSupabaseFrom({
      issues: [
        { data: { solutions: [], status: "in_progress" }, error: null },
        { data: null, error: null },
      ],
      issue_events: { data: null, error: null },
    });
    const res = await PUT(putReq({ description: "First plan" }), ctx("i1"));
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith("issue_events");
  });

  it("500s when the propose event insert fails", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({
      issues: { data: { solutions: [], status: "open" }, error: null },
      issue_events: { data: null, error: { message: "fail" } },
    });
    const res = await PUT(putReq({ description: "plan" }), ctx("i1"));
    expect(res.status).toBe(500);
  });

  it("500s when the final issues update fails", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({
      issues: [
        { data: { solutions: [], status: "open" }, error: null },
        { data: null, error: { message: "fail" } },
      ],
      issue_events: { data: null, error: null },
    });
    const res = await PUT(putReq({ description: "plan" }), ctx("i1"));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/session/issues/[issueId]/solution", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await DELETE({} as any, ctx("i1"));
    expect(res.status).toBe(401);
  });

  it("403s for a role outside strategist/fund_manager", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await DELETE({} as any, ctx("i1"));
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await DELETE({} as any, ctx("i1"));
    expect(res.status).toBe(403);
  });

  it("404s when the issue does not exist", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ issues: { data: null, error: null } });
    const res = await DELETE({} as any, ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("404s and logs when the issue fetch itself errors", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ issues: { data: null, error: { message: "db down" } } });
    const res = await DELETE({} as any, ctx("i1"));
    expect(res.status).toBe(404);
  });

  it("404s when there is no active solution to scratch", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ issues: { data: { solutions: [{ id: "s1", status: "scratched" }], status: "in_progress" }, error: null } });
    const res = await DELETE({} as any, ctx("i1"));
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toBe("No active solution to scratch");
  });

  it("treats a null solutions column as an empty array (no active solution)", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ issues: { data: { solutions: null, status: "open" }, error: null } });
    const res = await DELETE({} as any, ctx("i1"));
    expect(res.status).toBe(404);
  });

  it("scratches the active solution and reverts status in_progress->open", async () => {
    mockAuth(auth, fakeSession(["strategist"], { userEmail: "s@xtnl-solutions.com" }));
    mockSupabaseFrom({
      issues: [
        { data: { solutions: [{ id: "s1", status: "active" }], status: "in_progress" }, error: null },
        { data: null, error: null },
      ],
      issue_events: { data: null, error: null },
    });
    const res = await DELETE({} as any, ctx("i1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("scratches the active solution without touching status when it isn't in_progress", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({
      issues: [
        { data: { solutions: [{ id: "s1", status: "active" }], status: "open" }, error: null },
        { data: null, error: null },
      ],
      issue_events: { data: null, error: null },
    });
    const res = await DELETE({} as any, ctx("i1"));
    expect(res.status).toBe(200);
  });

  it("500s when the scratch event insert fails", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({
      issues: { data: { solutions: [{ id: "s1", status: "active" }], status: "in_progress" }, error: null },
      issue_events: { data: null, error: { message: "fail" } },
    });
    const res = await DELETE({} as any, ctx("i1"));
    expect(res.status).toBe(500);
  });

  it("falls back scratched_by to 'unknown' when the session has no userEmail", async () => {
    mockAuth(auth, fakeSession(["strategist"], { userEmail: undefined } as any));
    mockSupabaseFrom({
      issues: [
        { data: { solutions: [{ id: "s1", status: "active" }], status: "in_progress" }, error: null },
        { data: null, error: null },
      ],
      issue_events: { data: null, error: null },
    });
    const res = await DELETE({} as any, ctx("i1"));
    expect(res.status).toBe(200);
  });

  it("500s when the final update fails", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({
      issues: [
        { data: { solutions: [{ id: "s1", status: "active" }], status: "in_progress" }, error: null },
        { data: null, error: { message: "fail" } },
      ],
      issue_events: { data: null, error: null },
    });
    const res = await DELETE({} as any, ctx("i1"));
    expect(res.status).toBe(500);
  });
});
