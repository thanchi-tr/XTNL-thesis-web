import { SignJWT, jwtVerify } from "jose";

const secret = () =>
  new TextEncoder().encode(
    process.env.WATCH_JWT_SECRET ?? "xtnl-watch-fallback-secret-change-me-32"
  );

export interface WatchClaims { userId: string }

/** Next 02:00 AEST as a real UTC Date (uses fixed UTC+10 offset) */
function next2AmAEST(): Date {
  const AEST = 10 * 3_600_000;
  const nowAestMs = Date.now() + AEST;
  const d = new Date(nowAestMs);
  d.setUTCHours(2, 0, 0, 0);                       // 02:00 in AEST-shifted space
  if (d.getTime() <= nowAestMs) d.setUTCDate(d.getUTCDate() + 1);
  return new Date(d.getTime() - AEST);              // back to real UTC
}

export async function signWatchToken(
  userId: string
): Promise<{ token: string; expiresAt: string }> {
  const expiresAt = next2AmAEST();
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
  } catch {
    return null;
  }
}
