import { NextResponse, type NextRequest } from "next/server";
import { supabase, OPERATOR_USER_ID }     from "@/lib/supabase";

const PREFIX     = "watch_device:";
const TTL_MS     = 10 * 60 * 1000;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genCode(len = 6) {
  return Array.from({ length: len }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

function resolveBaseUrl(req: NextRequest): string {
  const env = process.env.NEXTAUTH_URL;
  if (env && !env.includes("localhost")) return env.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (host) return `${proto}://${host}`;
  return "https://xtnl-solutions.com";
}

/** POST — watch requests a device code and gets back a QR URL.
 *  Body: { deviceId?: string, deviceName?: string }
 *  deviceId and deviceName are stored so the authorize step can register the device server-side. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { deviceId?: string; deviceName?: string };

  const userCode   = genCode();
  const deviceCode = `XTNL-${userCode}`;
  const expiresMs  = Date.now() + TTL_MS;
  const verifyUrl  = `${resolveBaseUrl(req)}/watch-auth?code=${encodeURIComponent(deviceCode)}`;

  const payload = {
    deviceCode,
    userCode,
    verifyUrl,
    expiresMs,
    status:       "pending",
    token:        null,
    tokenExpiresAt: null,
    // Device info stored so authorize can create the watch_devices: record immediately
    deviceId:     body.deviceId   ?? null,
    deviceName:   body.deviceName ?? null,
  };
  const now = new Date().toISOString();

  const { error } = await supabase.from("comments").insert({
    content:    PREFIX + JSON.stringify(payload),
    created_at: now,
    Entry:      now,
    user_id:    OPERATOR_USER_ID,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deviceCode, userCode, verifyUrl, expiresIn: TTL_MS / 1000 });
}
