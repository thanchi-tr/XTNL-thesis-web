import { NextResponse } from "next/server";
import { auth }         from "@/auth";
import type { Session } from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
}

/* Real, non-free action (hits StoneX, writes to the DB via the Lambda) —
   restricted to the roles who actually run/own the weekly session. */
const ALLOWED_ROLES = ["analyst", "strategist", "fund_manager"];

/* POST — proxies to the deployed AWS Lambda /ingest endpoint. The API key
   stays server-side (PIPELINE_API_KEY) — never sent to the browser. */
export async function POST() {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = authed.roles ?? [];
    if (!roles.some(r => ALLOWED_ROLES.includes(r)))
      return NextResponse.json({ error: "Forbidden — analyst, strategist, or fund_manager role required" }, { status: 403 });

    const baseUrl = process.env.PIPELINE_API_BASE_URL;
    const apiKey  = process.env.PIPELINE_API_KEY;
    if (!baseUrl || !apiKey) {
      console.error("[trigger-ingest POST] PIPELINE_API_BASE_URL or PIPELINE_API_KEY not set");
      return NextResponse.json({ error: "Pipeline API is not configured." }, { status: 500 });
    }

    let res: Response;
    try {
      res = await fetch(`${baseUrl.replace(/\/$/, "")}/ingest`, {
        method:  "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body:    JSON.stringify({ trigger_source: "api" }),
      });
    } catch (e) {
      // Network-level failure (DNS, connection reset) — not a Gateway Timeout,
      // genuinely didn't reach the Lambda.
      console.error("[trigger-ingest POST] fetch failed", e);
      return NextResponse.json({ error: "Could not reach the pipeline API." }, { status: 502 });
    }

    // API Gateway's REST integration has a 29s hard timeout, well under the
    // Lambda's own 15-minute Timeout — a real ingestion run can outlast it.
    // A 504 here means API Gateway stopped waiting, NOT that the Lambda
    // failed to start (Lambda invocations continue running once triggered).
    // Treat it as an accepted trigger, matching the "fire and check back
    // later" UX in the pipeline banner.
    if (res.status === 504) {
      return NextResponse.json({ ok: true, stillRunning: true }, { status: 202 });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[trigger-ingest POST] Lambda returned", res.status, text);
      return NextResponse.json({ error: `Ingest trigger failed (${res.status})` }, { status: 502 });
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (e) {
    console.error("[trigger-ingest POST] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
