import { NextResponse, type NextRequest } from "next/server";
import { auth }                           from "@/auth";
import { createHash, randomBytes }        from "crypto";
import { readFile, writeFile, mkdir }     from "fs/promises";
import { join }                           from "path";
import QRCode                             from "qrcode";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";

/* ── Config ─────────────────────────────────────────────────── */
const RP_ID    = process.env.WEBAUTHN_RP_ID  ?? "localhost";
const ORIGIN   = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";
const APP_BASE = ORIGIN; // same origin for the mobile page URL

/* ── Credential store (shared with webauthn route) ──────────── */
const DATA_DIR   = process.env.VERCEL ? "/tmp/xtnl-data" : join(process.cwd(), "data");
const CREDS_FILE = join(DATA_DIR, "webauthn-credentials.json");

function emailHash(email: string): string {
  return createHash("sha256")
    .update(process.env.AUTH_SECRET! + email.toLowerCase().trim())
    .digest("hex");
}

interface StoredCred {
  id:         string;
  publicKey:  string;
  counter:    number;
  transports: AuthenticatorTransportFuture[];
}
interface CredStore { credentials: Record<string, StoredCred[]>; }

async function readCredStore(): Promise<CredStore> {
  try { return JSON.parse(await readFile(CREDS_FILE, "utf-8")) as CredStore; }
  catch { return { credentials: {} }; }
}
async function writeCredStore(s: CredStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CREDS_FILE, JSON.stringify(s, null, 2), "utf-8");
}

/* ── Mobile challenge store ──────────────────────────────────── */
interface ChallengeEntry {
  userHash:       string;
  webauthnChallenge: string;
  status:         "pending" | "verified";
  expiresAt:      number;
}

/* In-memory map — simple, no disk persistence needed (5 min TTL) */
const mobileTokens = new Map<string, ChallengeEntry>();

function pruneExpired() {
  const now = Date.now();
  for (const [k, v] of mobileTokens) {
    if (v.expiresAt < now) mobileTokens.delete(k);
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/mobile-challenge
   Desktop (authenticated session) → issues token + QR data URL
   ═══════════════════════════════════════════════════════════════ */
export async function POST() {
  const session = await auth();
  if (!session?.userEmail)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hash  = emailHash(session.userEmail);
  const store = await readCredStore();
  const creds = store.credentials[hash] ?? [];

  if (creds.length === 0)
    return NextResponse.json({ error: "No passkey registered for this account" }, { status: 400 });

  /* Generate WebAuthn options so they're ready when mobile arrives */
  const options = await generateAuthenticationOptions({
    rpID:             RP_ID,
    userVerification: "required",
    allowCredentials: creds.map(c => ({
      id:         Buffer.from(c.id, "base64url"),
      transports: c.transports,
      type:       "public-key" as const,
    })),
  });

  const token = randomBytes(24).toString("base64url");
  pruneExpired();
  mobileTokens.set(token, {
    userHash:          hash,
    webauthnChallenge: options.challenge,
    status:            "pending",
    expiresAt:         Date.now() + 5 * 60_000,
  });

  const mobileUrl = `${APP_BASE}/auth/mobile?t=${token}`;
  const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
    width:          220,
    margin:         1,
    color:          { dark: "#00cc7a", light: "#04080f" },
    errorCorrectionLevel: "M",
  });

  return NextResponse.json({ token, qrDataUrl, expiresIn: 300 });
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/auth/mobile-challenge?token=T&action=status|options
   ═══════════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const token  = params.get("token");
  const action = params.get("action") ?? "status";

  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const entry = mobileTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    mobileTokens.delete(token ?? "");
    return NextResponse.json({ status: "expired" });
  }

  /* Desktop polls for status */
  if (action === "status")
    return NextResponse.json({ status: entry.status });

  /* Mobile fetches WebAuthn options */
  if (action === "options") {
    const store = await readCredStore();
    const creds = store.credentials[entry.userHash] ?? [];
    const options = await generateAuthenticationOptions({
      rpID:             RP_ID,
      userVerification: "required",
      allowCredentials: creds.map(c => ({
        id:         Buffer.from(c.id, "base64url"),
        transports: c.transports,
        type:       "public-key" as const,
      })),
    });
    /* Overwrite challenge so mobile uses same one */
    entry.webauthnChallenge = options.challenge;
    return NextResponse.json(options);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/auth/mobile-challenge?token=T
   Mobile → posts signed WebAuthn assertion, marks token verified
   ═══════════════════════════════════════════════════════════════ */
export async function PATCH(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const entry = mobileTokens.get(token);
  if (!entry || entry.expiresAt < Date.now())
    return NextResponse.json({ error: "Token expired" }, { status: 400 });

  const body  = await req.json() as AuthenticationResponseJSON;
  const store = await readCredStore();
  const creds = store.credentials[entry.userHash] ?? [];
  const stored = creds.find(c => c.id === body.id);

  if (!stored)
    return NextResponse.json({ error: "Credential not found" }, { status: 400 });

  let result;
  try {
    result = await verifyAuthenticationResponse({
      response:                body,
      expectedChallenge:       entry.webauthnChallenge,
      expectedOrigin:          ORIGIN,
      expectedRPID:            RP_ID,
      requireUserVerification: true,
      authenticator: {
        credentialID:        new Uint8Array(Buffer.from(stored.id, "base64url")),
        credentialPublicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64")),
        counter:             stored.counter,
        transports:          stored.transports,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  if (!result.verified)
    return NextResponse.json({ verified: false });

  /* Update counter + mark token verified */
  stored.counter = result.authenticationInfo.newCounter;
  await writeCredStore(store);
  entry.status = "verified";

  return NextResponse.json({ verified: true });
}
