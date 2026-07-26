import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { mockSupabaseFrom } from "@/tests/setup/supabaseMock";
import { PATCH } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function ctx(sopId: string) {
  return { params: Promise.resolve({ sopId }) };
}

function patchReq(body: unknown) {
  return new Request("http://localhost/api/session/sops/1/status", { method: "PATCH", body: JSON.stringify(body) }) as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});

describe("PATCH /api/session/sops/[sopId]/status", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await PATCH(patchReq({ status: "archived" }), ctx("1"));
    expect(res.status).toBe(401);
  });

  it("403s for a role outside strategist/fund_manager", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await PATCH(patchReq({ status: "archived" }), ctx("1"));
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await PATCH(patchReq({ status: "archived" }), ctx("1"));
    expect(res.status).toBe(403);
  });

  it("400s on a non-integer sopId", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const res = await PATCH(patchReq({ status: "archived" }), ctx("abc"));
    expect(res.status).toBe(400);
  });

  it("400s on an invalid status value", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const res = await PATCH(patchReq({ status: "deleted" }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("400s on a malformed JSON body (parsed to null)", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    const badReq = new Request("http://localhost/api/session/sops/1/status", { method: "PATCH", body: "{not json" }) as any;
    const res = await PATCH(badReq, ctx("1"));
    expect(res.status).toBe(400);
  });

  it("archives on the happy path", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ sop_checklists: { data: { id: 1, status: "archived" }, error: null } });
    const res = await PATCH(patchReq({ status: "archived" }), ctx("1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.row.status).toBe("archived");
  });

  it("reactivates on the happy path", async () => {
    mockAuth(auth, fakeSession(["fund_manager"]));
    mockSupabaseFrom({ sop_checklists: { data: { id: 1, status: "active" }, error: null } });
    const res = await PATCH(patchReq({ status: "active" }), ctx("1"));
    const json = await res.json();
    expect(json.row.status).toBe("active");
  });

  it("500s on a supabase update error", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    mockSupabaseFrom({ sop_checklists: { data: null, error: { message: "fail" } } });
    const res = await PATCH(patchReq({ status: "archived" }), ctx("1"));
    expect(res.status).toBe(500);
  });

  it("500s on an unexpected exception", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    vi.spyOn(supabase, "from").mockImplementation(() => { throw new Error("boom"); });
    const res = await PATCH(patchReq({ status: "archived" }), ctx("1"));
    expect(res.status).toBe(500);
  });
});
