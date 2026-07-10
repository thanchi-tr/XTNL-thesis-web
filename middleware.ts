import { NextResponse } from "next/server";
import { auth } from "@/auth";

/* ── Per-tier IP rate limit ─────────────────────────────────────
   60-second sliding window. Higher privilege = more headroom.    */
const WINDOW_MS = 60_000;
const TIER_LIMITS: Record<string, number> = {
  fund_manager: 2000,
  strategist:    500,
  analyst:       200,
  operator:      100,
  guest:          20,
};

/* ── System-wide global cap ─────────────────────────────────────
   Blocks distributed floods that spread requests across many IPs.
   5 000 req/min across all callers triggers a global 429.         */
const SYSTEM_LIMIT = 5_000;

/* ── CSRF: allowed browser origins for state-mutating requests ──
   Origin header is present in all browser-initiated cross-origin
   requests; absent on same-origin requests (safe) and native apps. */
/* Next Auth v5 uses AUTH_URL; fall back to legacy NEXTAUTH_URL */
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  [
    (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL)?.replace(/\/$/, ""),
    process.env.NODE_ENV === "development" ? "http://localhost:3000" : "",
    process.env.NODE_ENV === "development" ? "http://localhost:3001" : "",
  ].filter(Boolean) as string[]
);

/* HTTP methods that cannot cause side-effects — exempt from CSRF check */
const CSRF_SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/* ── In-memory stores (per edge process instance) ─────────────── */
const store = new Map<string, { count: number; start: number }>();
let system  = { count: 0, start: Date.now() };
let nextCleanup = 0;

function evictStale() {
  const now = Date.now();
  if (now < nextCleanup) return;
  nextCleanup = now + 5 * 60_000;
  for (const [k, v] of store.entries()) {
    if (now - v.start > WINDOW_MS) store.delete(k);
  }
}

function getTier(roles: string[], authed: boolean): string {
  if (!authed) return "guest";
  if (roles.includes("fund_manager")) return "fund_manager";
  if (roles.includes("strategist"))   return "strategist";
  if (roles.includes("analyst"))      return "analyst";
  if (roles.includes("operator"))     return "operator";
  return "guest";
}

/* Paths exempt from ALL rate limiting and CSRF checks */
function isExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") || // NextAuth callbacks must never be blocked
    pathname === "/rate-limited" ||
    pathname === "/sign-error" ||
    /\.(ico|png|svg|jpg|jpeg|webp|woff2?|ttf|otf|css|js\.map)$/.test(pathname)
  );
}

/* Watch API routes are called from a native Android app — no browser
   Origin header is present; CSRF does not apply to them. */
function isWatchRoute(pathname: string): boolean {
  return pathname.startsWith("/api/watch/");
}

/* ── Middleware ─────────────────────────────────────────────────── */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (isExempt(pathname)) return NextResponse.next();

  /* ── CORS preflight for watch routes ──────────────────────────
     Native Android OkHttpClient does not send OPTIONS, but a browser-
     based companion (or curl/Postman) will. Respond immediately with
     204 so the preflight never hits rate-limiting or CSRF checks.
     next.config.ts already appends Access-Control-* headers to all
     /api/* responses, so we only need the status here.              */
  if (isWatchRoute(pathname) && req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Device-Id",
        "Access-Control-Max-Age":       "86400",
      },
    });
  }

  evictStale();
  const now = Date.now();

  /* ── 1. System-wide global rate limit ─────────────────────────
     Applied first so distributed floods are stopped before any
     per-IP accounting gives them false headroom.                  */
  if (now - system.start >= WINDOW_MS) {
    system = { count: 1, start: now };
  } else {
    system.count++;
    if (system.count > SYSTEM_LIMIT) {
      const headers: Record<string, string> = {
        "Retry-After": "60",
        "X-RateLimit-Scope": "system",
      };
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "System capacity reached. Please retry in 60 seconds." },
          { status: 429, headers }
        );
      }
      const dest = new URL("/rate-limited", req.nextUrl.origin);
      dest.searchParams.set("reset", String(system.start + WINDOW_MS));
      dest.searchParams.set("tier", "system");
      return NextResponse.redirect(dest, 302);
    }
  }

  /* ── 2. CSRF — Origin header check ───────────────────────────
     Browser-initiated cross-origin requests include an Origin header.
     Same-origin requests (safe) and native-app requests (no Origin)
     are allowed through; only a mismatched Origin is rejected.
     Watch routes are exempt because the Android watch app has no Origin.
     We compare against both NEXTAUTH_URL (env) and the request's own
     host so the check works even if NEXTAUTH_URL is misconfigured.    */
  const method = req.method ?? "GET";
  if (
    pathname.startsWith("/api/") &&
    !isWatchRoute(pathname) &&
    !CSRF_SAFE.has(method)
  ) {
    const origin = req.headers.get("origin");
    if (origin !== null) {
      /* Build the canonical origin from forwarded headers (Vercel sets
         x-forwarded-proto=https even though the internal protocol is http,
         so req.nextUrl.protocol is unreliable for the HTTPS origin check). */
      const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(/:$/, "");
      const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
      const requestOrigin = `${proto}://${host}`;
      if (!ALLOWED_ORIGINS.has(origin) && origin !== requestOrigin) {
        return NextResponse.json(
          { error: "Forbidden: cross-origin request rejected" },
          { status: 403, headers: { "X-Rejected-Origin": "1" } }
        );
      }
    }
  }

  /* ── 3. Per-IP per-tier sliding-window rate limit ─────────────
     Applied after system check so system floods hit the global cap
     before each IP accumulates individual counts.                 */
  const session = (req as any).auth;
  const roles   = (session?.roles    as string[] | undefined) ?? [];
  const authed  = Boolean(session?.twoFactorVerified);
  const tier    = getTier(roles, authed);
  const limit   = TIER_LIMITS[tier] ?? 20;

  /* Vercel sets x-forwarded-for reliably; fall back to x-real-ip */
  const ip  = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";

  const key   = `${ip}::${tier}`;
  let   entry = store.get(key);

  if (!entry || now - entry.start >= WINDOW_MS) {
    store.set(key, { count: 1, start: now });
    return NextResponse.next();
  }

  entry.count++;
  if (entry.count <= limit) return NextResponse.next();

  /* Limit exceeded */
  const resetAt = entry.start + WINDOW_MS;
  const retryIn = Math.max(1, Math.ceil((resetAt - now) / 1_000));

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: retryIn },
      {
        status: 429,
        headers: {
          "Retry-After":           String(retryIn),
          "X-RateLimit-Limit":     String(limit),
          "X-RateLimit-Reset":     String(resetAt),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Tier":      tier,
        },
      }
    );
  }

  const dest = new URL("/rate-limited", req.nextUrl.origin);
  dest.searchParams.set("reset", String(resetAt));
  dest.searchParams.set("tier",  tier);
  return NextResponse.redirect(dest, 302);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
