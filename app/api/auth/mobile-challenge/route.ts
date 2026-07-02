import { NextResponse, type NextRequest } from "next/server";
import { auth }                           from "@/auth";
import { createHash, randomBytes }        from "crypto";
import { readFile, writeFile, mkdir }     from "fs/promises";
import { join }                           from "path";
import QRCode                             from "qrcode";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";

/* ── Config ─────────────────────────────────────────────────── */
const RP_NAME  = "XTNL Solutions";
const RP_ID    = process.env.WEBAUTHN_RP_ID  ?? "localhost";
const ORIGIN   = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";
const APP_BASE = ORIGIN;

/* ── Credential store ────────────────────────────────────────── */
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

/* ── Mobile token store ──────────────────────────────────────── */
type TokenType = "auth" | "register";

interface ChallengeEntry {
  type:              TokenType;
  userHash:          string;
  userEmail:         string;
  webauthnChallenge: string;
  status:            "pending" | "verified";
  expiresAt:         number;
}

const mobileTokens = new Map<string, ChallengeEntry>();

function pruneExpired() {
  const now = Date.now();
  for (const [k, v] of mobileTokens) {
    if (v.expiresAt < now) mobileTokens.delete(k);
  }
}

async function makeQR(url: string) {
  return QRCode.toDataURL(url, {
    width: 220, margin: 1,
    color: { dark: "#00cc7a", light: "#04080f" },
    errorCorrectionLevel: "M",
  });
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/mobile-challenge?type=auth|register
   Desktop (authenticated) → issues token + QR data URL
   ═══════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userEmail)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type    = (req.nextUrl.searchParams.get("type") ?? "auth") as TokenType;
  const hash    = emailHash(session.userEmail);
  const store   = await readCredStore();
  const creds   = store.credentials[hash] ?? [];

  pruneExpired();

  /* ── Register: issue a phone-registration QR ── */
  if (type === "register") {
    const options = await generateRegistrationOptions({
      rpName:          RP_NAME,
      rpID:            RP_ID,
      userID:          hash.slice(0, 32),
      userName:        session.userEmail,
      userDisplayName: session.userName || session.userEmail,
      attestationType: "none",
      excludeCredentials: creds.map(c => ({
        id:         Buffer.from(c.id, "base64url"),
        transports: c.transports,
        type:       "public-key" as const,
      })),
      authenticatorSelection: {
        /* platform → phone's own biometric (Face ID / fingerprint) */
        authenticatorAttachment: "platform",
        residentKey:             "discouraged",
        userVerification:        "required",
      },
    });

    const token = randomBytes(24).toString("base64url");
    mobileTokens.set(token, {
      type:              "register",
      userHash:          hash,
      userEmail:         session.userEmail,
      webauthnChallenge: options.challenge,
      status:            "pending",
      expiresAt:         Date.now() + 5 * 60_000,
    });

    const mobileUrl = `${APP_BASE}/auth/mobile-register?t=${token}`;
    const qrDataUrl = await makeQR(mobileUrl);
    return NextResponse.json({ token, qrDataUrl, expiresIn: 300 });
  }

  /* ── Auth: issue a phone sign-in QR ── */
  if (creds.length === 0)
    return NextResponse.json({ error: "No passkey registered for this account" }, { status: 400 });

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
  mobileTokens.set(token, {
    type:              "auth",
    userHash:          hash,
    userEmail:         session.userEmail,
    webauthnChallenge: options.challenge,
    status:            "pending",
    expiresAt:         Date.now() + 5 * 60_000,
  });

  const mobileUrl = `${APP_BASE}/auth/mobile?t=${token}`;
  const qrDataUrl = await makeQR(mobileUrl);
  return NextResponse.json({ token, qrDataUrl, expiresIn: 300 });
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/auth/mobile-challenge?token=T&action=status|options|reg-options
   ═══════════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const token  = params.get("token");
  const action = params.get("action") ?? "status";

  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const entry = mobileTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    if (token) mobileTokens.delete(token);
    return NextResponse.json({ status: "expired" });
  }

  if (action === "status")
    return NextResponse.json({ status: entry.status });

  /* Mobile fetches auth options */
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
    entry.webauthnChallenge = options.challenge;
    return NextResponse.json(options);
  }

  /* Mobile fetches registration options */
  if (action === "reg-options") {
    const store = await readCredStore();
    const creds = store.credentials[entry.userHash] ?? [];
    const options = await generateRegistrationOptions({
      rpName:          RP_NAME,
      rpID:            RP_ID,
      userID:          entry.userHash.slice(0, 32),
      userName:        entry.userEmail,
      userDisplayName: entry.userEmail,
      attestationType: "none",
      excludeCredentials: creds.map(c => ({
        id:         Buffer.from(c.id, "base64url"),
        transports: c.transports,
        type:       "public-key" as const,
      })),
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey:             "discouraged",
        userVerification:        "required",
      },
    });
    entry.webauthnChallenge = options.challenge;
    return NextResponse.json(options);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/auth/mobile-challenge?token=T
   Mobile → submits WebAuthn response, marks token verified
   ═══════════════════════════════════════════════════════════════ */
export async function PATCH(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const entry = mobileTokens.get(token);
  if (!entry || entry.expiresAt < Date.now())
    return NextResponse.json({ error: "Token expired" }, { status: 400 });

  const store = await readCredStore();

  /* ── Registration verification ── */
  if (entry.type === "register") {
    const body = await req.json() as RegistrationResponseJSON;
    let result;
    try {
      result = await verifyRegistrationResponse({
        response:                body,
        expectedChallenge:       entry.webauthnChallenge,
        expectedOrigin:          ORIGIN,
        expectedRPID:            RP_ID,
        requireUserVerification: true,
      });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }

    if (!result.verified || !result.registrationInfo)
      return NextResponse.json({ verified: false });

    const { credentialID, credentialPublicKey, counter } = result.registrationInfo;
    if (!store.credentials[entry.userHash]) store.credentials[entry.userHash] = [];

    store.credentials[entry.userHash].push({
      id:         Buffer.from(credentialID).toString("base64url"),
      publicKey:  Buffer.from(credentialPublicKey).toString("base64"),
      counter,
      transports: (body.response.transports ?? ["internal"]) as AuthenticatorTransportFuture[],
    });

    await writeCredStore(store);
    entry.status = "verified";
    return NextResponse.json({ verified: true });
  }

  /* ── Authentication verification ── */
  const body   = await req.json() as AuthenticationResponseJSON;
  const creds  = store.credentials[entry.userHash] ?? [];
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

  stored.counter = result.authenticationInfo.newCounter;
  await writeCredStore(store);
  entry.status = "verified";
  return NextResponse.json({ verified: true });
}
