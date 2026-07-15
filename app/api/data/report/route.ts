import { NextResponse, type NextRequest } from "next/server";
import { auth }                           from "@/auth";
import { readFile, writeFile, mkdir }     from "fs/promises";
import { join }                           from "path";
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

/* ── Server-side report cache ────────────────────────────────
   The report is pulled from OneDrive ON DEMAND (analyst weekend
   session → POST) and cached locally on the server. Page loads
   read through this cache and only touch OneDrive on a cold miss.
   On Vercel the CWD is read-only, so the cache lives in /tmp.     */
const DATA_DIR    = process.env.VERCEL ? "/tmp/xtnl-data" : join(process.cwd(), "data");
const CACHE_FILE  = join(DATA_DIR, "report-cache.json");

interface CachedReport {
  content:    string;
  filename:   string;
  reportDate: string;   // weekKey the report belongs to (Monday AEST)
  fetchedAt:  string;   // ISO timestamp of the OneDrive pull
  weekKey:    string;   // weekKey at time of pull (== reportDate)
}

async function readCache(): Promise<CachedReport | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as CachedReport;
  } catch {
    return null;   // no file / unreadable → treated as a cache miss
  }
}

async function writeCache(report: CachedReport): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(report), "utf-8");
}

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

/* ── OneDrive pull ──────────────────────────────────────────────
   Strategy: list the Reports folder children, find the file by name
   (avoids Graph API's tilde-in-path-segment bug), then download by
   item ID. This is the expensive path — three sequential Graph calls.
   Only invoked on a cold cache miss (GET) or an on-demand refresh (POST). */
async function pullFromOneDrive(weekKey: string, log?: string[]): Promise<CachedReport> {
  const token = await getGraphToken();
  log?.push("Graph token acquired");

  const items = await listChildren(token, REPORT_BASE);
  log?.push(`Listed ${items.length} item(s) in Reports folder`);

  const item = items.find(f => (f.name as string) === LIVE_FILE);
  if (!item) {
    const names = items.map(f => f.name as string).join(", ");
    throw new Error(`"${LIVE_FILE}" not found in Reports folder. Items found: [${names || "none"}]`);
  }

  const content = await downloadById(token, item.id as string);
  log?.push(`Downloaded ${content.length} chars`);

  return {
    content,
    filename:   LIVE_FILE,
    reportDate: weekKey,
    fetchedAt:  new Date().toISOString(),
    weekKey,
  };
}

/* Shape the JSON payload returned to clients (never expose the raw cache struct). */
function toResponse(
  report: CachedReport,
  source: "cache" | "onedrive",
  extra: Record<string, unknown> = {},
) {
  return {
    content:    report.content,
    filename:   report.filename,
    reportDate: report.reportDate,
    fetchedAt:  report.fetchedAt,
    source,                                              // "cache" | "onedrive"
    stale:      report.weekKey !== getMondayAESTKey(),   // cached data is from a prior week
    ...extra,
  };
}

function isRefresher(session: unknown): boolean {
  const roles = ((session as { roles?: string[] } | null)?.roles) ?? [];
  return roles.some(r => ["analyst", "strategist", "fund_manager"].includes(r));
}

/* ── GET — read-through cache ────────────────────────────────────
   Serve the locally-cached report immediately. Only when the cache
   is genuinely empty (cold miss) do we pull from OneDrive, populate
   the cache, and return. Never revalidates against OneDrive on a
   time schedule — fresh data arrives via the on-demand POST refresh. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(session as { twoFactorVerified?: boolean } | null)?.twoFactorVerified)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const debug = process.env.NODE_ENV === "development" &&
                req.nextUrl.searchParams.get("debug") === "1";
  const log: string[] = [];

  const cached = await readCache();
  if (cached) {
    log.push(`Cache hit — pulled ${cached.fetchedAt}, week ${cached.weekKey}`);
    return NextResponse.json(toResponse(cached, "cache", debug ? { _log: log } : {}));
  }

  /* Cold miss — no cache on this server instance yet. Pull once. */
  const weekKey = getMondayAESTKey();
  log.push(`Cache miss — pulling ${LIVE_PATH} from OneDrive user ${USER_ID}`);
  try {
    const report = await pullFromOneDrive(weekKey, log);
    await writeCache(report);
    log.push("Cache populated");
    return NextResponse.json(toResponse(report, "onedrive", debug ? { _log: log } : {}));
  } catch (e) {
    console.error("[report GET]", e);
    log.push(`Error: ${String(e)}`);
    return NextResponse.json(
      { error: "Failed to load report. Please try again later.", ...(debug ? { _log: log } : {}) },
      { status: 500 }
    );
  }
}

/* ── POST — on-demand refresh ────────────────────────────────────
   Invoked by the analyst during the weekend analysis session. Always
   pulls fresh from OneDrive and overwrites the server cache. Gated to
   roles that run analysis so the expensive Graph path can't be abused. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(session as { twoFactorVerified?: boolean } | null)?.twoFactorVerified)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isRefresher(session))
    return NextResponse.json({ error: "Analyst role required to refresh." }, { status: 403 });

  const debug = process.env.NODE_ENV === "development" &&
                req.nextUrl.searchParams.get("debug") === "1";
  const log: string[] = [];
  const weekKey = getMondayAESTKey();

  try {
    log.push(`On-demand refresh — pulling ${LIVE_PATH} from OneDrive user ${USER_ID}`);
    const report = await pullFromOneDrive(weekKey, log);
    await writeCache(report);
    log.push("Cache overwritten with fresh pull");
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
