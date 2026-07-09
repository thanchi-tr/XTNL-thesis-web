import { SignJWT, jwtVerify } from "jose";

const secret = () => {
  const s = process.env.WATCH_JWT_SECRET;
  /* Fail fast in production so a missing env var is caught at startup,
     not discovered after a watch token is silently signed with a known key. */
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("WATCH_JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(s ?? "xtnl-watch-fallback-secret-change-me-32");
};

export interface WatchClaims { userId: string }

export async function signWatchToken(
  userId: string
): Promise<{ token: string; expiresAt: string }> {
  // 30-day expiry — long-lived so tokens don't expire mid-trading-session.
  // The previous next2AmAEST() approach could produce a token that expired within
  // seconds if auth happened between midnight and 2 AM AEST.
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setIssuer("xtnl-watch")
    .sign(secret());
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function verifyWatchToken(token: string): Promise<WatchClaims | null> {
  const { claims } = await verifyWatchTokenReason(token);
  return claims;
}

/** Same as verifyWatchToken but returns the jose rejection reason so API routes
 *  can include it in the 401 response body — visible in watch Logcat. */
export async function verifyWatchTokenReason(
  token: string
): Promise<{ claims: WatchClaims; reason: null } | { claims: null; reason: string }> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "xtnl-watch" });
    return { claims: { userId: payload.userId as string }, reason: null };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[verifyWatchToken] rejected:", reason);
    return { claims: null, reason };
  }
}
