import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { mockSupabaseFrom } from "@/tests/setup/supabaseMock";
import { GET, POST } from "./route";

function throwingAuth() {
  vi.mocked(auth).mockRejectedValue(new Error("boom"));
}

vi.mock("@/auth", () => ({ auth: vi.fn() }));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});

describe("GET /api/session/weekly-signoff", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns signedOff:false when nothing is on file", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ analyst_weekly_signoff: { data: null, error: null } });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.signedOff).toBe(false);
  });

  it("returns signedOff:true with who/when for any 2FA-verified role", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({
      analyst_weekly_signoff: {
        data: { signed_off_by: "a@xtnl-solutions.com", signed_off_at: "2026-04-13T10:00:00Z" },
        error: null,
      },
    });
    const res = await GET();
    const json = await res.json();
    expect(json.signedOff).toBe(true);
    expect(json.signedOffBy).toBe("a@xtnl-solutions.com");
  });

  it("500s on a supabase error", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ analyst_weekly_signoff: { data: null, error: { message: "fail" } } });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("500s on an unexpected exception", async () => {
    throwingAuth();
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/session/weekly-signoff", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("403s for a role other than analyst", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("upserts the sign-off on the happy path", async () => {
    mockAuth(auth, fakeSession(["analyst"], { userEmail: "a@xtnl-solutions.com" }));
    mockSupabaseFrom({
      analyst_weekly_signoff: { data: { signed_off_by: "a@xtnl-solutions.com" }, error: null },
    });
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.row.signed_off_by).toBe("a@xtnl-solutions.com");
  });

  it("is idempotent on a repeat click (still 201, still succeeds)", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    mockSupabaseFrom({ analyst_weekly_signoff: { data: {}, error: null } });
    const res1 = await POST();
    const res2 = await POST();
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
  });

  it("500s on a supabase upsert error", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    mockSupabaseFrom({ analyst_weekly_signoff: { data: null, error: { message: "fail" } } });
    const res = await POST();
    expect(res.status).toBe(500);
  });

  it("500s on an unexpected exception", async () => {
    throwingAuth();
    const res = await POST();
    expect(res.status).toBe(500);
  });
});
