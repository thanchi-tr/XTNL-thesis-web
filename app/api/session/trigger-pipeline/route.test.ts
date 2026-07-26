import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { GET, POST } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function tokenResponse() {
  return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
}
function postReq(body: unknown) {
  return new Request("http://localhost/api/session/trigger-pipeline", { method: "POST", body: JSON.stringify(body) }) as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

describe("GET /api/session/trigger-pipeline", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("403s for a role outside the allowed set", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns an empty result when the debug folder doesn't exist yet (404)", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.outliersCount).toBe(0);
  });

  it("returns an empty result when the folder is empty of matching files", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ id: "1", name: "readme.txt" }] }), { status: 200 }));
    const res = await GET();
    const json = await res.json();
    expect(json.outliersCount).toBe(0);
  });

  it("picks the lexicographically newest debug file and returns its contents", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [
          { id: "old", name: "2026-04-01.suspicious_entries.json" },
          { id: "new", name: "2026-04-15.suspicious_entries.json" },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ trade_id: "t1" }, { trade_id: "t2" }]), { status: 200 }));
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.outliersCount).toBe(2);
  });

  it("reports 0 outliers when the downloaded file is not a JSON array", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ id: "1", name: "2026-04-01.suspicious_entries.json" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ not: "an array" }), { status: 200 }));
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.outliersCount).toBe(0);
  });

  it("500s when the folder listing request fails non-404", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("500s when the file download fails", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ id: "1", name: "2026-04-01.suspicious_entries.json" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("500s when the Graph token response has no access_token", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "invalid_client" }), { status: 200 }));
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("500s with a stringified message when a non-Error value is thrown", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockRejectedValueOnce("network fail");
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.error).toBe("network fail");
  });

  it("picks the newest file even when a smaller name appears mid-list", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch)
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [
          { id: "mid", name: "2026-04-15.suspicious_entries.json" },
          { id: "old", name: "2026-04-01.suspicious_entries.json" },
          { id: "new", name: "2026-04-20.suspicious_entries.json" },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ trade_id: "t1" }]), { status: 200 }));
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.outliersCount).toBe(1);
  });
});

describe("POST /api/session/trigger-pipeline", () => {
  beforeEach(() => {
    vi.stubEnv("PIPELINE_API_BASE_URL", "https://pipeline.example.com");
    vi.stubEnv("PIPELINE_API_KEY", "test-key");
  });

  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await POST(postReq({ mode: "debug" }));
    expect(res.status).toBe(401);
  });

  it("403s for a role outside the allowed set", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await POST(postReq({ mode: "debug" }));
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await POST(postReq({ mode: "debug" }));
    expect(res.status).toBe(403);
  });

  it("defaults to live mode when mode is missing or invalid", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await POST(postReq({}));
    const json = await res.json();
    expect(json.mode).toBe("live");
  });

  it("passes mode=debug through unchanged", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await POST(postReq({ mode: "debug" }));
    const json = await res.json();
    expect(json.mode).toBe("debug");
    const call = vi.mocked(fetch).mock.calls[0];
    const sentBody = JSON.parse((call[1] as RequestInit).body as string);
    expect(sentBody).toEqual({ mode: "debug", trigger_source: "api-debug" });
  });

  it("500s when the pipeline API is not configured", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.stubEnv("PIPELINE_API_KEY", "");
    const res = await POST(postReq({ mode: "live" }));
    expect(res.status).toBe(500);
  });

  it("502s on a network-level fetch failure", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockRejectedValue(new Error("ENOTFOUND"));
    const res = await POST(postReq({ mode: "live" }));
    expect(res.status).toBe(502);
  });

  it("502s with a stringified message when a non-Error value is thrown", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockRejectedValue("plain string failure");
    const res = await POST(postReq({ mode: "live" }));
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.error).toMatch(/plain string failure/);
  });

  it("tolerates a malformed JSON body by defaulting to live mode", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const badReq = new Request("http://localhost/api/session/trigger-pipeline", { method: "POST", body: "{not json" }) as any;
    const res = await POST(badReq);
    const json = await res.json();
    expect(res.status).toBe(202);
    expect(json.mode).toBe("live");
  });

  it("treats a 504 as accepted, still-running", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 504 }));
    const res = await POST(postReq({ mode: "live" }));
    const json = await res.json();
    expect(res.status).toBe(202);
    expect(json.stillRunning).toBe(true);
  });

  it("maps a 403 upstream response to a clear API-key error", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 403 }));
    const res = await POST(postReq({ mode: "live" }));
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toMatch(/PIPELINE_API_KEY/);
  });

  it("maps a 404 upstream response to a clear base-URL error", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 404 }));
    const res = await POST(postReq({ mode: "live" }));
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toMatch(/PIPELINE_API_BASE_URL/);
  });

  it("maps a 429 upstream response to a rate-limit error", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 429 }));
    const res = await POST(postReq({ mode: "live" }));
    expect(res.status).toBe(429);
  });

  it("falls back to 502 for an upstream status outside the 400-599 mapped range", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValue(new Response("redirected", { status: 300 }));
    const res = await POST(postReq({ mode: "live" }));
    expect(res.status).toBe(502);
  });

  it("500s when reading the upstream error body itself fails", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    const fakeRes = { ok: false, status: 500, text: () => Promise.reject(new Error("stream error")) } as Response;
    vi.mocked(fetch).mockResolvedValue(fakeRes);
    const res = await POST(postReq({ mode: "live" }));
    expect(res.status).toBe(500);
  });

  it("returns 202 with mode on the happy path", async () => {
    mockAuth(auth, fakeSession(["fund_manager"]));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await POST(postReq({ mode: "debug" }));
    const json = await res.json();
    expect(res.status).toBe(202);
    expect(json.ok).toBe(true);
    expect(json.mode).toBe("debug");
  });

  it("500s on an unexpected exception", async () => {
    vi.mocked(auth).mockRejectedValue(new Error("boom"));
    const res = await POST(postReq({ mode: "live" }));
    expect(res.status).toBe(500);
  });
});
