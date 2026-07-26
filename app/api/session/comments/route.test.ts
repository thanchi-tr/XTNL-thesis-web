import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { mockSupabaseFrom } from "@/tests/setup/supabaseMock";
import { GET, POST, DELETE } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function postReq(body: unknown) {
  return new Request("http://localhost/api/session/comments", { method: "POST", body: JSON.stringify(body) });
}
function deleteReq(body: unknown) {
  return new Request("http://localhost/api/session/comments", { method: "DELETE", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
});

describe("GET /api/session/comments", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns recent comments for any 2FA-verified user", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ comments: { data: [{ content: "hi" }], error: null } });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.rows).toEqual([{ content: "hi" }]);
  });

  it("500s on a supabase error", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ comments: { data: null, error: { message: "fail" } } });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("returns an empty array when data is null", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ comments: { data: null, error: null } });
    const res = await GET();
    const json = await res.json();
    expect(json.rows).toEqual([]);
  });

  it("500s on an unexpected exception", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    vi.spyOn(supabase, "from").mockImplementation(() => { throw new Error("boom"); });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/session/comments", () => {
  const validBody = { content: "Looks good", created_at: "2026-04-13T09:00:00Z" };

  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(401);
  });

  it("400s when content is missing or blank", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await POST(postReq({ ...validBody, content: "   " }));
    expect(res.status).toBe(400);
  });

  it("400s when content exceeds 2000 characters", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await POST(postReq({ ...validBody, content: "x".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("400s on an invalid created_at", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await POST(postReq({ ...validBody, created_at: "not-a-date" }));
    expect(res.status).toBe(400);
  });

  it("truncates trade_id to 64 characters and accepts a null trade_id", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ comments: { data: { id: 1, trade_id: "x".repeat(64) }, error: null } });
    const res = await POST(postReq({ ...validBody, trade_id: "x".repeat(100) }));
    expect(res.status).toBe(201);
  });

  it("inserts without user_id when no operator id and no session user id are available", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const spy = mockSupabaseFrom({ comments: { data: { id: 1, content: "Looks good" }, error: null } });
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    expect(spy).toHaveBeenCalledWith("comments");
  });

  it("attaches user_id from session.user.id when present", async () => {
    mockAuth(auth, fakeSession(["operator"], { user: { id: "u1" } } as any));
    mockSupabaseFrom({ comments: { data: { id: 1, user_id: "u1" }, error: null } });
    const res = await POST(postReq(validBody));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.row.user_id).toBe("u1");
  });

  it("500s on a supabase insert error", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ comments: { data: null, error: { message: "fail" } } });
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(500);
  });

  it("500s when insert returns no data and no error", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    mockSupabaseFrom({ comments: { data: null, error: null } });
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(500);
  });

  it("500s on an unexpected exception (e.g. malformed JSON body)", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const badReq = new Request("http://localhost/api/session/comments", { method: "POST", body: "{not json" });
    const res = await POST(badReq);
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/session/comments", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await DELETE(deleteReq({ created_at: "2026-04-13T09:00:00Z" }));
    expect(res.status).toBe(401);
  });

  it("400s on an invalid created_at", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await DELETE(deleteReq({ created_at: "not-a-date" }));
    expect(res.status).toBe(400);
  });

  it("404s when the comment does not exist", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    mockSupabaseFrom({ comments: { data: null, error: null } });
    const res = await DELETE(deleteReq({ created_at: "2026-04-13T09:00:00Z" }));
    expect(res.status).toBe(404);
  });

  it("403s when trying to delete an operator (non-analyst) comment", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    mockSupabaseFrom({ comments: { data: { content: "Operator note" }, error: null } });
    const res = await DELETE(deleteReq({ created_at: "2026-04-13T09:00:00Z" }));
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toBe("Operator comments are immutable");
  });

  it("deletes an analyst comment on the happy path", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    mockSupabaseFrom({
      comments: [
        { data: { content: "Analyst comment: reviewed" }, error: null },
        { data: null, error: null },
      ],
    });
    const res = await DELETE(deleteReq({ created_at: "2026-04-13T09:00:00Z" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("500s when the delete call fails", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    mockSupabaseFrom({
      comments: [
        { data: { content: "Analyst comment: reviewed" }, error: null },
        { data: null, error: { message: "fail" } },
      ],
    });
    const res = await DELETE(deleteReq({ created_at: "2026-04-13T09:00:00Z" }));
    expect(res.status).toBe(500);
  });

  it("500s on an unexpected exception (e.g. malformed JSON body)", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    const badReq = new Request("http://localhost/api/session/comments", { method: "DELETE", body: "{not json" });
    const res = await DELETE(badReq);
    expect(res.status).toBe(500);
  });
});
