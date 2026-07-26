import { describe, it, expect, beforeEach, vi } from "vitest";
import { auth } from "@/auth";
import { fakeSession, mockAuth } from "@/tests/setup/authMock";
import { POST } from "./route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(auth).mockReset();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubEnv("PIPELINE_API_BASE_URL", "https://pipeline.example.com");
  vi.stubEnv("PIPELINE_API_KEY", "test-key");
});

describe("POST /api/session/trigger-ingest", () => {
  it("401s when unauthenticated", async () => {
    mockAuth(auth, null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("403s for a role outside analyst/strategist/fund_manager", async () => {
    mockAuth(auth, fakeSession(["operator"]));
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("403s when the session carries no roles field at all", async () => {
    mockAuth(auth, { twoFactorVerified: true, userEmail: "x@xtnl-solutions.com", userName: "X" } as any);
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("500s when PIPELINE_API_BASE_URL or PIPELINE_API_KEY is not configured", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.stubEnv("PIPELINE_API_BASE_URL", "");
    const res = await POST();
    expect(res.status).toBe(500);
  });

  it("502s when the fetch to the pipeline API fails at the network level", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockRejectedValue(new Error("ENOTFOUND"));
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.error).toMatch(/Could not reach the pipeline API/);
  });

  it("502s with a stringified message when a non-Error value is thrown", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockRejectedValue("plain string failure");
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.error).toMatch(/plain string failure/);
  });

  it("500s when reading the upstream error body itself fails", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    const fakeRes = { ok: false, status: 500, text: () => Promise.reject(new Error("stream error")) } as Response;
    vi.mocked(fetch).mockResolvedValue(fakeRes);
    const res = await POST();
    expect(res.status).toBe(500);
  });

  it("treats a 504 as an accepted, still-running trigger", async () => {
    mockAuth(auth, fakeSession(["strategist"]));
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 504 }));
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(202);
    expect(json.stillRunning).toBe(true);
  });

  it("maps a 403 upstream response to a clear API-key error", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValue(new Response("forbidden", { status: 403 }));
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toMatch(/PIPELINE_API_KEY/);
  });

  it("maps a 404 upstream response to a clear base-URL error", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValue(new Response("not found", { status: 404 }));
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toMatch(/PIPELINE_API_BASE_URL/);
  });

  it("maps a 429 upstream response to a rate-limit error", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValue(new Response("slow down", { status: 429 }));
    const res = await POST();
    expect(res.status).toBe(429);
  });

  it("falls back to 502 for an upstream status outside the 400-599 mapped range", async () => {
    mockAuth(auth, fakeSession(["analyst"]));
    vi.mocked(fetch).mockResolvedValue(new Response("redirected", { status: 300 }));
    const res = await POST();
    expect(res.status).toBe(502);
  });

  it("returns 202 accepted on the happy path", async () => {
    mockAuth(auth, fakeSession(["fund_manager"]));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(202);
    expect(json.ok).toBe(true);
  });

  it("500s on an unexpected exception", async () => {
    vi.mocked(auth).mockRejectedValue(new Error("boom"));
    const res = await POST();
    expect(res.status).toBe(500);
  });
});
