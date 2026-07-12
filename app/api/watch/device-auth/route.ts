import { NextResponse, type NextRequest } from "next/server";
import { supabase }                       from "@/lib/supabase";

const TTL_MS     = 10 * 60 * 1000;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const MAX_DEVICE_ID_LEN   = 128;
const MAX_DEVICE_NAME_LEN = 64;
const DEVICE_ID_RE   = /^[a-zA-Z0-9\-_:.]+$/;
const DEVICE_NAME_RE = /^[\w\s\-.'()À-ɏ]+$/u;

function genCode(len = 6) {
  return Array.from({ length: len }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

function resolveBaseUrl(req: NextRequest): string {
  const env = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (env && !env.includes("localhost")) return env.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (host) return `${proto}://${host}`;
  return "https://xtnl-solutions.com";
}

/** POST — watch requests a device code and gets back a QR URL.
 *  Body: { deviceId?: string, deviceName?: string } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { deviceId?: unknown; deviceName?: unknown };

  const rawId   = typeof body.deviceId   === "string" ? body.deviceId.slice(0, MAX_DEVICE_ID_LEN)     : "";
  const rawName = typeof body.deviceName === "string" ? body.deviceName.slice(0, MAX_DEVICE_NAME_LEN) : "";

  const deviceId   = rawId   && DEVICE_ID_RE.test(rawId)    ? rawId   : null;
  const deviceName = rawName && DEVICE_NAME_RE.test(rawName) ? rawName : null;

  const userCode   = genCode();
  const deviceCode = `XTNL-${userCode}`;
  const expiresAt  = new Date(Date.now() + TTL_MS).toISOString();
  const verifyUrl  = `${resolveBaseUrl(req)}/watch-auth?code=${encodeURIComponent(deviceCode)}`;

  const { error } = await supabase.from("watch_device_codes").insert({
    device_code: deviceCode,
    user_code:   userCode,
    device_id:   deviceId,
    device_name: deviceName,
    status:      "pending",
    expires_at:  expiresAt,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deviceCode, userCode, verifyUrl, expiresIn: TTL_MS / 1000 });
}
