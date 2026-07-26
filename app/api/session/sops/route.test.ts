import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { mockSupabaseFrom } from "@/tests/setup/supabaseMock";
import { GET, POST } from "./route";

function throwingSupabase() {
  return vi.spyOn(supabase, "from").mockImplementation(() => { throw new Error("boom"); });
}

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function postReq(body: unknown) {
  return new Request("http://localhost/api/session/sops", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});

describe("GET /api/session/sops", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("403s for a role outside strategist/fund_manager", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns the SOP list for a strategist", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ sop_checklists: { data: [{ id: 1, title: "Entry" }], error: null } });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.rows).toEqual([{ id: 1, title: "Entry" }]);
  });

  it("returns an empty array when data is null", async () => {
    mockAuth(auth, fakeSession(["fund_manager"]));
    mockSupabaseFrom({ sop_checklists: { data: null, error: null } });
    const res = await GET();
    const json = await res.json();
    expect(json.rows).toEqual([]);
  });

  it("500s on a supabase error", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ sop_checklists: { data: null, error: { message: "db down" } } });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("500s on an unexpected exception", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    throwingSupabase();
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/session/sops", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await POST(postReq({ title: "t", items: ["a"] }));
    expect(res.status).toBe(401);
  });

  it("403s for a role outside strategist/fund_manager", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    const res = await POST(postReq({ title: "t", items: ["a"] }));
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await POST(postReq({ title: "t", items: ["a"] }));
    expect(res.status).toBe(403);
  });

  it("400s on a malformed JSON body (parsed to null)", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const badReq = new Request("http://localhost/api/session/sops", { method: "POST", body: "{not json" });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it("400s on invalid input, surfacing the validator's error message", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const res = await POST(postReq({ title: "", items: [] }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("Title is required");
  });

  it("creates a SOP checklist on the happy path", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const spy = mockSupabaseFrom({
      sop_checklists: { data: { id: 1, title: "Entry", tags: [], items: ["a"] }, error: null },
    });
    const res = await POST(postReq({ title: "Entry", items: ["a"], tags: [] }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.row.title).toBe("Entry");
    expect(spy).toHaveBeenCalledWith("sop_checklists");
  });

  it("500s on a supabase insert error", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ sop_checklists: { data: null, error: { message: "insert failed" } } });
    const res = await POST(postReq({ title: "Entry", items: ["a"] }));
    expect(res.status).toBe(500);
  });

  it("500s on an unexpected exception", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    throwingSupabase();
    const res = await POST(postReq({ title: "Entry", items: ["a"] }));
    expect(res.status).toBe(500);
  });
});
