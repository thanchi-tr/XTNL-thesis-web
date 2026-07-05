/**
 * GET /api/watch/ping
 *
 * Diagnostic endpoint — validates the watch Bearer token and reports exactly why
 * it was rejected. Useful for debugging "token rejected" without reading Vercel logs.
 *
 * curl https://xtnl-solutions.com/api/watch/ping \
 *   -H "Authorization: Bearer <token>"
 *
 * Returns 200 { ok: true, userId }  when valid.
 * Returns 401 { ok: false, reason } when invalid.
 */
import { NextResponse }       from "next/server";
import { jwtVerify, decodeJwt } from "jose";

const secret = () =>
  new TextEncoder().encode(
    process.env.WATCH_JWT_SECRET ?? "xtnl-watch-fallback-secret-change-me-32"
  );

export async function GET(req: Request) {
  const header = req.headers.get("Authorization") ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    return NextResponse.json({ ok: false, reason: "No Authorization header" }, { status: 401 });
  }

  // Decode WITHOUT verifying so we can show claims even on failure
  let decoded: Record<string, unknown> | null = null;
  try { decoded = decodeJwt(token) as Record<string, unknown>; } catch { /* malformed */ }

  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "xtnl-watch" });
    return NextResponse.json({
      ok:     true,
      userId: payload.userId,
      exp:    payload.exp ? new Date((payload.exp as number) * 1000).toISOString() : null,
      iss:    payload.iss,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[watch/ping] token rejected:", reason);
    return NextResponse.json({
      ok:      false,
      reason,
      decoded,  // shows claims so you can see exp/iss even without verification
    }, { status: 401 });
  }
}
