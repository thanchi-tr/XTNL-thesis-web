import { SignJWT, jwtVerify } from "jose";

const secret = () =>
  new TextEncoder().encode(
    process.env.WATCH_JWT_SECRET ?? "xtnl-watch-fallback-secret-change-me-32"
  );

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
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "xtnl-watch" });
    return { userId: payload.userId as string };
  } catch (e) {
    console.error("[verifyWatchToken] rejected:", e instanceof Error ? e.message : String(e));
    return null;
  }
}
