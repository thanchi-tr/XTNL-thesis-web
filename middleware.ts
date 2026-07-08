import { NextResponse } from "next/server";
import { auth } from "@/auth";

/* ── Rate limit config ───────────────────────────────────────
   Window = 60 seconds. Higher privilege = more headroom.
   fund_manager is effectively unlimited for normal usage.  */
const WINDOW_MS = 60_000;
const TIER_LIMITS: Record<string, number> = {
  fund_manager: 2000,
  strategist:    500,
  analyst:       200,
  operator:      100,
  guest:          20,
};

/* In-memory sliding-window store (per edge instance) */
const store = new Map<string, { count: number; start: number }>();
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

/* Paths that are always allowed through without rate limiting */
function isExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") || // NextAuth callbacks must never be blocked
    pathname === "/rate-limited" ||
    pathname === "/sign-error" ||
    /\.(ico|png|svg|jpg|jpeg|webp|woff2?|ttf|otf|css|js\.map)$/.test(pathname)
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (isExempt(pathname)) return NextResponse.next();

  evictStale();

  /* Determine tier from session attached by NextAuth */
  const session  = (req as any).auth;
  const roles    = (session?.roles    as string[] | undefined) ?? [];
  const authed   = Boolean(session?.twoFactorVerified);
  const tier     = getTier(roles, authed);
  const limit    = TIER_LIMITS[tier] ?? 20;

  /* Identify by IP (Vercel sets x-forwarded-for) */
  const ip = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";

  const key = `${ip}::${tier}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) {
    store.set(key, { count: 1, start: now });
    return NextResponse.next();
  }

  entry.count++;

  if (entry.count <= limit) return NextResponse.next();

  /* ── Rate limit exceeded ──────────────────────────────── */
  const resetAt = entry.start + WINDOW_MS;
  const retryIn = Math.max(1, Math.ceil((resetAt - now) / 1_000));

  /* API routes → 429 JSON */
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: retryIn },
      {
        status: 429,
        headers: {
          "Retry-After":  String(retryIn),
          "X-RateLimit-Limit":     String(limit),
          "X-RateLimit-Reset":     String(resetAt),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  /* Page routes → animated countdown page */
  const dest = new URL("/rate-limited", req.nextUrl.origin);
  dest.searchParams.set("reset", String(resetAt));
  dest.searchParams.set("tier",  tier);
  return NextResponse.redirect(dest, 302);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
