import { NextResponse, type NextRequest }   from "next/server";
import { auth }                              from "@/auth";
import { createHash }                        from "crypto";
import { readFile, writeFile, mkdir }        from "fs/promises";
import { join }                              from "path";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";

/* ── RP config ─────────────────────────────────────────────────
 * WEBAUTHN_RP_ID    — the domain (e.g. "xtnl-solutions.com")
 * WEBAUTHN_ORIGIN   — full origin (e.g. "https://xtnl-solutions.com")
 * Both default to localhost for local development.              */
const RP_NAME = "XTNL Solutions";
const RP_ID   = process.env.WEBAUTHN_RP_ID  ?? "localhost";
const ORIGIN  = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

/* ── Credential store ─────────────────────────────────────────
 * Same file-based pattern as the TOTP route.
 * Email is hashed (SHA-256 + secret) — never stored plain.     */
const DATA_DIR   = process.env.VERCEL ? "/tmp/xtnl-data" : join(process.cwd(), "data");
const CREDS_FILE = join(DATA_DIR, "webauthn-credentials.json");

function emailHash(email: string): string {
  return createHash("sha256")
    .update(process.env.AUTH_SECRET! + email.toLowerCase().trim())
    .digest("hex");
}

interface StoredCred {
  id:         string;                       // base64url credential ID
  publicKey:  string;                       // base64-encoded Uint8Array
  counter:    number;
  transports: AuthenticatorTransportFuture[];
}

interface CredStore {
  credentials: Record<string, StoredCred[]>;
}

async function readStore(): Promise<CredStore> {
  try {
    return JSON.parse(await readFile(CREDS_FILE, "utf-8")) as CredStore;
  } catch {
    return { credentials: {} };
  }
}

async function writeStore(s: CredStore): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CREDS_FILE, JSON.stringify(s, null, 2), "utf-8");
}

/* ── In-memory challenge store (120 s TTL per user) ─────────── */
const challenges = new Map<string, string>();

function setChallenge(hash: string, value: string) {
  challenges.set(hash, value);
  setTimeout(() => challenges.delete(hash), 120_000);
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/auth/webauthn?action=status|register|authenticate
   ═══════════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.userEmail)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hash   = emailHash(session.userEmail);
  const action = req.nextUrl.searchParams.get("action") ?? "status";
  const store  = await readStore();
  const creds  = store.credentials[hash] ?? [];

  /* ── status: does this user have a passkey? ── */
  if (action === "status") {
    return NextResponse.json({ hasPasskey: creds.length > 0 });
  }

  /* ── register: generate options for passkey enrollment ──
     ?attachment=cross-platform  → phone/roaming authenticator (Microsoft Authenticator)
     ?attachment=platform        → this device (Windows Hello, Touch ID)
     (omitted)                   → browser decides (usually platform first)          */
  if (action === "register") {
    const attachment = req.nextUrl.searchParams.get("attachment");

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
        /* cross-platform → forces browser to show QR / phone / USB key options only
           (never Windows Hello) so the user can register Microsoft Authenticator.
           platform        → Windows Hello / Touch ID / Face ID on this machine.
           userVerification "required" on cross-platform enforces phone biometric.
           "preferred" on platform avoids Windows Hello hard-failing when PIN/Hello
           isn't fully configured — it still uses biometric when available. */
        ...(attachment === "cross-platform" && { authenticatorAttachment: "cross-platform" }),
        ...(attachment === "platform"       && { authenticatorAttachment: "platform" }),
        residentKey:      attachment === "cross-platform" ? "required" : "discouraged",
        userVerification: attachment === "cross-platform" ? "required" : "preferred",
      },
    });
    setChallenge(hash, options.challenge);
    return NextResponse.json(options);
  }

  /* ── authenticate: generate options for passkey sign-in ── */
  if (action === "authenticate") {
    if (creds.length === 0)
      return NextResponse.json({ error: "No passkey registered" }, { status: 400 });

    const options = await generateAuthenticationOptions({
      rpID:             RP_ID,
      userVerification: "required",
      allowCredentials: creds.map(c => ({
        id:         Buffer.from(c.id, "base64url"),
        transports: c.transports,
        type:       "public-key" as const,
      })),
    });
    setChallenge(hash, options.challenge);
    return NextResponse.json(options);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/webauthn?action=register|authenticate
   ═══════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userEmail)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hash      = emailHash(session.userEmail);
  const action    = req.nextUrl.searchParams.get("action") ?? "";
  const challenge = challenges.get(hash);

  if (!challenge)
    return NextResponse.json({ error: "Challenge expired — please try again" }, { status: 400 });

  /* ── verify registration ── */
  if (action === "register") {
    const body = await req.json() as RegistrationResponseJSON;

    let result;
    try {
      result = await verifyRegistrationResponse({
        response:                body,
        expectedChallenge:       challenge,
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
    const store = await readStore();
    if (!store.credentials[hash]) store.credentials[hash] = [];

    store.credentials[hash].push({
      id:         Buffer.from(credentialID).toString("base64url"),
      publicKey:  Buffer.from(credentialPublicKey).toString("base64"),
      counter,
      transports: (body.response.transports ?? []) as AuthenticatorTransportFuture[],
    });

    await writeStore(store);
    challenges.delete(hash);
    return NextResponse.json({ verified: true });
  }

  /* ── verify authentication ── */
  if (action === "authenticate") {
    const body  = await req.json() as AuthenticationResponseJSON;
    const store = await readStore();
    const creds = store.credentials[hash] ?? [];
    const stored = creds.find(c => c.id === body.id);

    if (!stored)
      return NextResponse.json({ error: "Credential not found" }, { status: 400 });

    let result;
    try {
      result = await verifyAuthenticationResponse({
        response:                body,
        expectedChallenge:       challenge,
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

    /* update counter (replay protection) */
    stored.counter = result.authenticationInfo.newCounter;
    await writeStore(store);
    challenges.delete(hash);
    return NextResponse.json({ verified: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
