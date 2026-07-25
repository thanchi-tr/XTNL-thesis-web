import { NextRequest, NextResponse } from "next/server";
import { auth }                      from "@/auth";
import type { Session }              from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
}

/* Real, non-free action (hits StoneX, writes to the DB via the Lambda) —
   restricted to the roles who actually run/own the weekly session. */
const ALLOWED_ROLES = ["analyst", "strategist", "fund_manager"];

const TENANT_ID     = process.env.AZURE_TENANT_ID!;
const CLIENT_ID     = process.env.AZURE_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;
const USER_ID       = process.env.ONEDRIVE_USER_ID!;
const REPORT_BASE   = (process.env.REPORT_BASE_URL ?? "XTNLSolutions/Operations/Reports")
  .replace(/^["']|["']$/g, "")
  .replace(/\/$/, "");

async function getGraphToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope:         "https://graph.microsoft.com/.default",
      }),
    }
  );
  const j = await res.json() as { access_token?: string; error?: string; error_description?: string };
  if (!j.access_token) throw new Error(`Auth: ${j.error} — ${j.error_description}`);
  return j.access_token;
}

/* Matches src/helper/util.py's get_date_path() ("%Y/%B") — the Lambda writes
   the debug quarantine export under this folder with no TZ override, so it
   runs in Lambda's default UTC clock. Mirrored here in UTC to land in the
   same folder the pipeline actually wrote to. */
function currentDebugFolderUTC(): string {
  const now   = new Date();
  const year  = now.getUTCFullYear();
  const month = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `${REPORT_BASE}/Quarantine/debug/${year}/${month}`;
}

/* Picks the most recently generated debug quarantine file in a given
   Quarantine/debug/{year}/{month} folder listing. Filenames are
   "YYYY-MM-DD.suspicious_entries.json" — lexicographic order is chronological
   order for that format, so the max name is the newest run. */
function pickNewestDebugFile(files: { id: string; name: string }[]): { id: string; name: string } | null {
  const candidates = files.filter(f => f.name.endsWith(".suspicious_entries.json"));
  if (candidates.length === 0) return null;
  return candidates.reduce((newest, f) => (f.name > newest.name ? f : newest));
}

export async function GET() {
  const session = await auth() as Session | null;
  const authed  = getAuthedSession(session);
  if (!authed)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = authed.roles ?? [];
  if (!roles.some(r => ALLOWED_ROLES.includes(r)))
    return NextResponse.json({ error: "Forbidden — analyst, strategist, or fund_manager role required" }, { status: 403 });

  try {
    const token    = await getGraphToken();
    const folder   = currentDebugFolderUTC();
    const listUrl  = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(USER_ID)}/drive/root:/${folder}:/children?$top=100&$select=id,name,lastModifiedDateTime`;
    const listRes  = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });

    if (listRes.status === 404) {
      // No debug run yet this month — not an error, just nothing to show.
      return NextResponse.json({ outliersCount: 0, outliers: [], generatedAt: null });
    }
    if (!listRes.ok) throw new Error(`Graph list ${listRes.status}`);

    const { value = [] } = await listRes.json() as { value?: { id: string; name: string }[] };
    const newest = pickNewestDebugFile(value);
    if (!newest) {
      return NextResponse.json({ outliersCount: 0, outliers: [], generatedAt: null });
    }

    const dlUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(USER_ID)}/drive/items/${newest.id}/content`;
    const dlRes = await fetch(dlUrl, { headers: { Authorization: `Bearer ${token}` }, redirect: "follow" });
    if (!dlRes.ok) throw new Error(`Graph download ${dlRes.status}`);

    const outliers = await dlRes.json() as unknown[];
    return NextResponse.json({
      outliersCount: Array.isArray(outliers) ? outliers.length : 0,
      outliers,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* POST — proxies to the deployed AWS Lambda /run-pipeline endpoint. The API
   key stays server-side (PIPELINE_API_KEY) — never sent to the browser.
   `mode` rides through to the Lambda unchanged (PIPELINE_MODE env var) and
   also picks a mode-specific trigger_source so debug vs. live runs are
   distinguishable in ingestion_jobs without a separate lock key. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = authed.roles ?? [];
    if (!roles.some(r => ALLOWED_ROLES.includes(r)))
      return NextResponse.json({ error: "Forbidden — analyst, strategist, or fund_manager role required" }, { status: 403 });

    const body = await req.json().catch(() => ({})) as { mode?: string };
    const mode = body.mode === "debug" ? "debug" : "live";

    const baseUrl = process.env.PIPELINE_API_BASE_URL;
    const apiKey  = process.env.PIPELINE_API_KEY;
    if (!baseUrl || !apiKey) {
      console.error("[trigger-pipeline POST] PIPELINE_API_BASE_URL or PIPELINE_API_KEY not set");
      return NextResponse.json({ error: "Pipeline API is not configured." }, { status: 500 });
    }

    let res: Response;
    try {
      res = await fetch(`${baseUrl.replace(/\/$/, "")}/run-pipeline`, {
        method:  "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body:    JSON.stringify({ mode, trigger_source: mode === "debug" ? "api-debug" : "api-live" }),
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("[trigger-pipeline POST] fetch failed — check PIPELINE_API_BASE_URL", e);
      return NextResponse.json(
        { error: `Could not reach the pipeline API (${detail}). Check PIPELINE_API_BASE_URL for stray quotes/whitespace.` },
        { status: 502 },
      );
    }

    // API Gateway's REST integration has a 29s hard timeout, well under the
    // Lambda's own 15-minute Timeout — a real pipeline run (~27-30s per
    // observed logs) can outlast it. A 504 here means API Gateway stopped
    // waiting, NOT that the Lambda failed to start.
    if (res.status === 504) {
      return NextResponse.json({ ok: true, stillRunning: true, mode }, { status: 202 });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[trigger-pipeline POST] Lambda returned", res.status, text);
      const message =
        res.status === 403 ? "Rejected by API Gateway — check PIPELINE_API_KEY." :
        res.status === 404 ? "Endpoint not found — check PIPELINE_API_BASE_URL." :
        res.status === 429 ? "Rate limit exceeded — try again shortly." :
        `Pipeline trigger failed (upstream status ${res.status}).`;
      return NextResponse.json({ error: message }, { status: res.status >= 400 && res.status < 600 ? res.status : 502 });
    }

    return NextResponse.json({ ok: true, mode }, { status: 202 });
  } catch (e) {
    console.error("[trigger-pipeline POST] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
