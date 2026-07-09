import { NextResponse, type NextRequest } from "next/server";
import { supabase, OPERATOR_USER_ID }     from "@/lib/supabase";

const PREFIX  = "watch_device:";
const TTL_MS  = 10 * 60 * 1000;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/* ── Input constraints ───────────────────────────────────────── */
const MAX_DEVICE_ID_LEN   = 128;
const MAX_DEVICE_NAME_LEN = 64;
/* Device IDs from Android are UUIDs or package-name strings:
   alphanumeric, hyphens, colons, underscores, dots only.         */
const DEVICE_ID_RE   = /^[a-zA-Z0-9\-_:.]+$/;
/* Human-readable names: letters, digits, spaces, and a safe set of
   punctuation. Blocks HTML tags, script characters, control chars. */
const DEVICE_NAME_RE = /^[\w\s\-.'()À-ɏ]+$/u;

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
 *  Both fields are validated and stored for the authorize step.  */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { deviceId?: unknown; deviceName?: unknown };

  /* ── Validate and sanitize device fields ──────────────────── */
  const rawId   = typeof body.deviceId   === "string" ? body.deviceId.slice(0, MAX_DEVICE_ID_LEN)   : "";
  const rawName = typeof body.deviceName === "string" ? body.deviceName.slice(0, MAX_DEVICE_NAME_LEN) : "";

  const deviceId   = rawId   && DEVICE_ID_RE.test(rawId)     ? rawId   : null;
  const deviceName = rawName && DEVICE_NAME_RE.test(rawName)  ? rawName : null;

  const userCode   = genCode();
  const deviceCode = `XTNL-${userCode}`;
  const expiresMs  = Date.now() + TTL_MS;
  const verifyUrl  = `${resolveBaseUrl(req)}/watch-auth?code=${encodeURIComponent(deviceCode)}`;

  const payload = {
    deviceCode,
    userCode,
    verifyUrl,
    expiresMs,
    status:         "pending",
    token:          null,
    tokenExpiresAt: null,
    deviceId,
    deviceName,
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
