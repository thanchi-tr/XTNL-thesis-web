import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { mockSupabaseFrom } from "@/tests/setup/supabaseMock";
import { PUT, DELETE } from "./route";

function throwingSupabase() {
  return vi.spyOn(supabase, "from").mockImplementation(() => { throw new Error("boom"); });
}

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function ctx(sopId: string) {
  return { params: Promise.resolve({ sopId }) };
}

function putReq(body: unknown) {
  return new Request("http://localhost/api/session/sops/1", { method: "PUT", body: JSON.stringify(body) }) as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});

describe("PUT /api/session/sops/[sopId]", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await PUT(putReq({ title: "t", items: ["a"] }), ctx("1"));
    expect(res.status).toBe(401);
  });

  it("403s for a role outside strategist/fund_manager", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await PUT(putReq({ title: "t", items: ["a"] }), ctx("1"));
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await PUT(putReq({ title: "t", items: ["a"] }), ctx("1"));
    expect(res.status).toBe(403);
  });

  it("400s on a non-integer sopId", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const res = await PUT(putReq({ title: "t", items: ["a"] }), ctx("abc"));
    expect(res.status).toBe(400);
  });

  it("400s on invalid input", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const res = await PUT(putReq({ title: "", items: [] }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("400s on a malformed JSON body (parsed to null)", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const badReq = new Request("http://localhost/api/session/sops/1", { method: "PUT", body: "{not json" }) as any;
    const res = await PUT(badReq, ctx("1"));
    expect(res.status).toBe(400);
  });

  it("updates on the happy path", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ sop_checklists: { data: { id: 1, title: "Updated" }, error: null } });
    const res = await PUT(putReq({ title: "Updated", items: ["a"] }), ctx("1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.row.title).toBe("Updated");
  });

  it("500s on a supabase update error", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ sop_checklists: { data: null, error: { message: "fail" } } });
    const res = await PUT(putReq({ title: "Updated", items: ["a"] }), ctx("1"));
    expect(res.status).toBe(500);
  });

  it("500s on an unexpected exception", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    throwingSupabase();
    const res = await PUT(putReq({ title: "Updated", items: ["a"] }), ctx("1"));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/session/sops/[sopId]", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await DELETE({} as any, ctx("1"));
    expect(res.status).toBe(401);
  });

  it("403s for a role outside strategist/fund_manager", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    const res = await DELETE({} as any, ctx("1"));
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await DELETE({} as any, ctx("1"));
    expect(res.status).toBe(403);
  });

  it("400s on a non-integer sopId", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const res = await DELETE({} as any, ctx("not-a-number"));
    expect(res.status).toBe(400);
  });

  it("deletes on the happy path", async () => {
    mockAuth(auth, fakeSession(["fund_manager"]));
    mockSupabaseFrom({ sop_checklists: { data: null, error: null } });
    const res = await DELETE({} as any, ctx("1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("500s on a supabase delete error", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ sop_checklists: { data: null, error: { message: "fail" } } });
    const res = await DELETE({} as any, ctx("1"));
    expect(res.status).toBe(500);
  });

  it("500s on an unexpected exception", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    throwingSupabase();
    const res = await DELETE({} as any, ctx("1"));
    expect(res.status).toBe(500);
  });
});
