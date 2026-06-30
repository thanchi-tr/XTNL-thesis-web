import { NextResponse }              from "next/server";
import { auth }                      from "@/auth";
import { createHmac, createHash }    from "crypto";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join }                      from "path";
import QRCode                        from "qrcode";

/* ── Enrollment store ───────────────────────────────────────
 * Persists which users have completed first-time TOTP setup.
 * Emails are stored as HMAC hashes — never in plaintext.
 * On Vercel the CWD is read-only; writes go to /tmp instead. */
const DATA_DIR      = process.env.VERCEL
  ? "/tmp/xtnl-data"
  : join(process.cwd(), "data");
const ENROLLED_FILE = join(DATA_DIR, "totp-enrolled.json");

function emailHash(email: string): string {
  return createHash("sha256")
    .update(process.env.AUTH_SECRET! + email.toLowerCase().trim())
    .digest("hex");
}

async function readEnrolled(): Promise<Set<string>> {
  try {
    const raw = await readFile(ENROLLED_FILE, "utf-8");
    const { enrolled } = JSON.parse(raw) as { enrolled: string[] };
    return new Set(enrolled);
  } catch {
    return new Set();
  }
}

async function writeEnrolled(set: Set<string>): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ENROLLED_FILE, JSON.stringify({ enrolled: [...set] }, null, 2), "utf-8");
}

/* ── Base32 helpers ─────────────────────────────────────── */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function b32Encode(buf: Buffer): string {
  let bits = 0, val = 0, out = "";
  for (const byte of buf) {
    val = (val << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

function b32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").toUpperCase();
  let bits = 0, val = 0;
  const bytes: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx < 0) continue;
    val = (val << 5) | idx; bits += 5;
    if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(bytes);
}

/* ── TOTP (RFC 6238 / SHA-1) ────────────────────────────── */
function totpCode(secret: string, stepOffset = 0): string {
  const key     = b32Decode(secret);
  const step    = Math.floor(Date.now() / 30_000) + stepOffset;
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(step));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const off  = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[off]     & 0x7f) << 24)
             | ((hmac[off + 1] & 0xff) << 16)
             | ((hmac[off + 2] & 0xff) << 8)
             |  (hmac[off + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

function totpVerify(token: string, secret: string): boolean {
  return [-1, 0, 1].some(w => totpCode(secret, w) === token);
}

/* ── Stable per-user secret ─────────────────────────────── */
function getTotpSecret(email: string): string {
  const raw = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(email.toLowerCase().trim())
    .digest();
  return b32Encode(raw).slice(0, 32);
}

/* ── GET /api/auth/totp ─────────────────────────────────────
 * Returns { enrolled: true } for returning users,
 * or     { enrolled: false, qrDataUrl } for first-timers.    */
export async function GET() {
  const session = await auth();
  if (!session?.userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enrolled   = await readEnrolled();
  const isEnrolled = enrolled.has(emailHash(session.userEmail));

  if (isEnrolled) {
    return NextResponse.json({ enrolled: true });
  }

  /* First-time setup: generate QR */
  const secret   = getTotpSecret(session.userEmail);
  const label    = encodeURIComponent(session.userEmail);
  const issuer   = encodeURIComponent("XTNL Sovereign Trust");
  const otpauth  = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  const qrDataUrl = await QRCode.toDataURL(otpauth, {
    width:  180,
    margin: 1,
    color:  { dark: "#000000", light: "#ffffff" },
  });

  return NextResponse.json({ enrolled: false, qrDataUrl });
}

/* ── POST /api/auth/totp ────────────────────────────────────
 * Verifies the 6-digit code. On first valid verify, marks
 * the user as enrolled so QR is never shown again.           */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { code?: string };
  const code = (body.code ?? "").replace(/\D/g, "");
  if (code.length !== 6) return NextResponse.json({ valid: false });

  const secret  = getTotpSecret(session.userEmail);
  const isValid = totpVerify(code, secret);

  if (isValid) {
    /* Persist enrollment so subsequent logins skip the QR step */
    const enrolled = await readEnrolled();
    enrolled.add(emailHash(session.userEmail));
    await writeEnrolled(enrolled);
  }

  return NextResponse.json({ valid: isValid });
}
