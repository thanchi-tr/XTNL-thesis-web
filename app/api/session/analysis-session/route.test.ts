import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { mockSupabaseFrom } from "@/tests/setup/supabaseMock";
import { GET, POST } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/session/analysis-session", () => {
  it("computes the week key on a Melbourne Sunday (getDay()===0 branch)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T02:00:00Z")); // Sunday noon AEST
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ comments: { data: null, error: null } });
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("computes the week key on a Melbourne weekday (getDay()!==0 branch)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T02:00:00Z")); // Wednesday noon AEST
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ comments: { data: null, error: null } });
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns done:false when no row exists yet this week (week-scoped, not per-user)", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ comments: { data: null, error: null } });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.done).toBe(false);
  });

  it("returns done:true when any user already marked it this week", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    mockSupabaseFrom({ comments: { data: { Entry: "2026-04-13T00:00:00Z" }, error: null } });
    const res = await GET();
    const json = await res.json();
    expect(json.done).toBe(true);
  });

  it("returns done:false (not a 500) if the lookup throws", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.spyOn(supabase, "from").mockImplementation(() => {
      throw new Error("boom");
    });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.done).toBe(false);
  });
});

describe("POST /api/session/analysis-session", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("is idempotent: returns done:true without inserting when already marked", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    const spy = mockSupabaseFrom({ comments: { data: { Entry: "2026-04-13T00:00:00Z" }, error: null } });
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.done).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1); // only the lookup, no insert
  });

  it("inserts a marker row on first submission this week", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    const spy = mockSupabaseFrom({
      comments: [
        { data: null, error: null }, // lookup: not yet marked
        { data: null, error: null }, // insert
      ],
    });
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.done).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("500s when the insert fails", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    mockSupabaseFrom({
      comments: [
        { data: null, error: null },
        { data: null, error: { message: "fail" } },
      ],
    });
    const res = await POST();
    expect(res.status).toBe(500);
  });

  it("500s on an unexpected exception", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.spyOn(supabase, "from").mockImplementation(() => {
      throw new Error("boom");
    });
    const res = await POST();
    expect(res.status).toBe(500);
  });

  it("attaches OPERATOR_USER_ID to the insert when configured", async () => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_USER_ID", "operator-uuid-1");
    try {
      const freshAuthMod = await import("@/auth");
      vi.mocked(freshAuthMod.auth).mockResolvedValue(fakeSession(["analyst"]) as any);
      const { mockSupabaseFrom: freshMock } = await import("@/tests/setup/supabaseMock");
      freshMock({ comments: [{ data: null, error: null }, { data: null, error: null }] });
      const { POST: freshPOST } = await import("./route");
      const res = await freshPOST();
      expect(res.status).toBe(200);
    } finally {
      vi.resetModules();
    }
  });
});
