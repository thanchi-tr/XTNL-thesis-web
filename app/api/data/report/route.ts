import { NextResponse, type NextRequest } from "next/server";
import { auth }                           from "@/auth";
import { unstable_cache, revalidateTag }  from "next/cache";
import { getMondayAESTKey }               from "@/lib/weekKey";

/* ── Config ─────────────────────────────────────────────────── */
const TENANT_ID     = process.env.AZURE_TENANT_ID!;
const CLIENT_ID     = process.env.AZURE_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;
const USER_ID       = process.env.ONEDRIVE_USER_ID!;
const REPORT_BASE   = (process.env.REPORT_BASE_URL ?? "XTNLSolutions/Operations/Reports")
  .replace(/^["']|["']$/g, "")   // strip surrounding quotes from .env.local
  .replace(/\/$/, "");

/* Fixed live report path — pipeline writes here every Monday */
const LIVE_FILE = "live.general.txt";
const LIVE_PATH = `${REPORT_BASE}/${LIVE_FILE}`;
const CACHE_TAG = "xtnl-live-report";

interface CachedReport {
  content:    string;
  filename:   string;
  reportDate: string;   // weekKey the report belongs to (Monday AEST)
  fetchedAt:  string;   // ISO timestamp of the OneDrive pull
  weekKey:    string;   // weekKey at time of pull (== reportDate)
}

/* ── Two-tier server cache ────────────────────────────────────
   The report is genuinely static for the whole trading week (the pipeline
   writes it once, Monday) — for a given week it never changes, so it's
   safe to cache indefinitely and only invalidate explicitly.

   Tier 1 (fastest) — a module-level variable. Costs zero I/O, but only
   lives for as long as this particular server instance stays warm; empty
   again after a cold start.

   Tier 2 (durable) — Next.js's Data Cache via unstable_cache. Unlike a raw
   file under /tmp (the previous approach here), this is NOT wiped on cold
   start and IS shared across concurrently-scaled instances on Vercel — a
   genuine server-side cache, not a per-instance illusion of one. Keyed by
   weekKey, so a new trading week naturally gets a fresh cache entry with
   no explicit invalidation needed; the on-demand POST refresh explicitly
   revalidates the tag so every instance's next read — durable or memory —
   picks up the fresh pull instead of serving stale same-week data. */
let memCache: CachedReport | null = null;

async function pullFromOneDrive(weekKey: string): Promise<CachedReport> {
  const token = await getGraphToken();
  const items = await listChildren(token, REPORT_BASE);

  const item = items.find(f => (f.name as string) === LIVE_FILE);
  if (!item) {
    const names = items.map(f => f.name as string).join(", ");
    throw new Error(`"${LIVE_FILE}" not found in Reports folder. Items found: [${names || "none"}]`);
  }

  const content = await downloadById(token, item.id as string);

  return {
    content,
    filename:   LIVE_FILE,
    reportDate: weekKey,
    fetchedAt:  new Date().toISOString(),
    weekKey,
  };
}

const getDurableCached = unstable_cache(
  (weekKey: string) => pullFromOneDrive(weekKey),
  ["xtnl-live-report"],
  { tags: [CACHE_TAG] },
);

/* ── Graph API helpers ──────────────────────────────────────── */
async function getGraphToken(): Promise<string> {
  const res  = await fetch(
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

/* List children of a folder by path.
   Returns raw Graph DriveItem array.                                            */
async function listChildren(token: string, folderPath: string): Promise<Record<string, unknown>[]> {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(USER_ID)}/drive/root:/${folderPath}:/children?$top=100&$select=id,name,%40microsoft.graph.downloadUrl`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph list ${res.status} on "${folderPath}": ${body.slice(0, 300)}`);
  }
  const j = await res.json() as { value?: Record<string, unknown>[] };
  return j.value ?? [];
}

/* Download a file by its Graph item ID — avoids any path/tilde encoding issues. */
async function downloadById(token: string, itemId: string): Promise<string> {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(USER_ID)}/drive/items/${itemId}/content`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "follow",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph download ${res.status} for item ${itemId}: ${body.slice(0, 200)}`);
  }
  return res.text();
}

/* Shape the JSON payload returned to clients (never expose the raw cache struct). */
function toResponse(
  report: CachedReport,
  source: "memory" | "cache" | "onedrive",
  extra: Record<string, unknown> = {},
) {
  return {
    content:    report.content,
    filename:   report.filename,
    reportDate: report.reportDate,
    fetchedAt:  report.fetchedAt,
    source,                                              // "memory" | "cache" | "onedrive"
    stale:      report.weekKey !== getMondayAESTKey(),   // cached data is from a prior week
    ...extra,
  };
}

function isRefresher(session: unknown): boolean {
  const roles = ((session as { roles?: string[] } | null)?.roles) ?? [];
  return roles.some(r => ["analyst", "strategist", "fund_manager"].includes(r));
}

/* ── GET — read-through, two-tier cache ──────────────────────────
   Tier 1: in-process memory, if it's still this week's report — instant,
   zero I/O. Tier 2: the durable Data Cache, which pulls from OneDrive
   itself on a genuine miss (new week, or first request since a cold
   deploy) and is shared across every server instance, not just this one. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(session as { twoFactorVerified?: boolean } | null)?.twoFactorVerified)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const debug = process.env.NODE_ENV === "development" &&
                req.nextUrl.searchParams.get("debug") === "1";
  const weekKey = getMondayAESTKey();

  if (memCache && memCache.weekKey === weekKey) {
    return NextResponse.json(toResponse(memCache, "memory", debug ? { _log: ["Memory tier hit"] } : {}));
  }

  try {
    const report = await getDurableCached(weekKey);
    memCache = report; // sync the memory tier so subsequent requests on this instance skip straight to tier 1
    return NextResponse.json(toResponse(report, "cache", debug ? { _log: [`Durable cache read for week ${weekKey}`] } : {}));
  } catch (e) {
    console.error("[report GET]", e);
    return NextResponse.json(
      { error: "Failed to load report. Please try again later.", ...(debug ? { _log: [`Error: ${String(e)}`] } : {}) },
      { status: 500 }
    );
  }
}

/* ── POST — on-demand refresh ────────────────────────────────────
   Invoked by the analyst during the weekend analysis session. Always
   pulls fresh from OneDrive, bypassing both cache tiers, then syncs this
   instance's memory tier immediately and revalidates the durable tier's
   tag so every other instance's next read also pulls fresh instead of
   serving the now-stale same-week entry. Gated to roles that run analysis
   so the expensive Graph path can't be abused. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(session as { twoFactorVerified?: boolean } | null)?.twoFactorVerified)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isRefresher(session))
    return NextResponse.json({ error: "Analyst role required to refresh." }, { status: 403 });

  const debug = process.env.NODE_ENV === "development" &&
                req.nextUrl.searchParams.get("debug") === "1";
  const weekKey = getMondayAESTKey();
  const log: string[] = [];

  try {
    log.push(`On-demand refresh — pulling ${LIVE_PATH} from OneDrive user ${USER_ID}`);
    const report = await pullFromOneDrive(weekKey);
    memCache = report;
    revalidateTag(CACHE_TAG);
    log.push("Memory tier synced, durable tier revalidated");
    return NextResponse.json(toResponse(report, "onedrive", debug ? { _log: log } : {}));
  } catch (e) {
    console.error("[report POST]", e);
    log.push(`Error: ${String(e)}`);
    return NextResponse.json(
      { error: "Refresh failed. Please try again.", ...(debug ? { _log: log } : {}) },
      { status: 500 }
    );
  }
}
