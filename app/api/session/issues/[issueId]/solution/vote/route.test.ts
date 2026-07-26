import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { mockSupabaseFrom } from "@/tests/setup/supabaseMock";
import { POST } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function ctx(issueId: string) {
  return { params: Promise.resolve({ issueId }) };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});

describe("POST /api/session/issues/[issueId]/solution/vote", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await POST({} as any, ctx("i1"));
    expect(res.status).toBe(401);
  });

  it("403s for a role outside the allowed set", async () => {
    mockAuth(auth, fakeSession(["nobody"]));
    const res = await POST({} as any, ctx("i1"));
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await POST({} as any, ctx("i1"));
    expect(res.status).toBe(403);
  });

  it("404s when there is no active solution", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ issues: { data: { solutions: [] }, error: null } });
    const res = await POST({} as any, ctx("i1"));
    expect(res.status).toBe(404);
  });

  it("404s when the issue fetch errors", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ issues: { data: null, error: { message: "fail" } } });
    const res = await POST({} as any, ctx("i1"));
    expect(res.status).toBe(404);
  });

  it("increments the vote count on the active solution and leaves other solutions untouched", async () => {
    mockAuth(auth, fakeSession(["analyst"], { userEmail: "a@xtnl-solutions.com" }));
    mockSupabaseFrom({
      issues: [
        { data: { solutions: [
          { id: "old", status: "scratched", votes: 9 },
          { id: "s1", status: "active", votes: 2 },
        ] }, error: null },
        { data: null, error: null },
      ],
      issue_events: { data: null, error: null },
    });
    const res = await POST({} as any, ctx("i1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.votes).toBe(3);
  });

  it("defaults votes to 0 before incrementing when undefined, and falls back actor to 'unknown'", async () => {
    mockAuth(auth, fakeSession(["analyst"], { userEmail: undefined } as any));
    mockSupabaseFrom({
      issues: [
        { data: { solutions: [{ id: "s1", status: "active" }] }, error: null },
        { data: null, error: null },
      ],
      issue_events: { data: null, error: null },
    });
    const res = await POST({} as any, ctx("i1"));
    const json = await res.json();
    expect(json.votes).toBe(1);
  });

  it("500s when the update fails", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      issues: [
        { data: { solutions: [{ id: "s1", status: "active", votes: 0 }] }, error: null },
        { data: null, error: { message: "fail" } },
      ],
      issue_events: { data: null, error: null },
    });
    const res = await POST({} as any, ctx("i1"));
    expect(res.status).toBe(500);
  });
});
