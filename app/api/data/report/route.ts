import { NextResponse, type NextRequest } from "next/server";
import { auth }                           from "@/auth";
import { unstable_cache }                 from "next/cache";

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

/* ── Cache key — Monday of the current AEST week ───────────────
   AEST = UTC+10. When Monday arrives in Australia, the key
   changes and unstable_cache re-fetches on the next request.    */
function getMondayAESTKey(): string {
  const now      = Date.now();
  const aestMs   = now + 10 * 60 * 60 * 1000;          // UTC+10 (AEST standard)
  const aestDate = new Date(aestMs);
  const dow      = aestDate.getUTCDay();                 // 0=Sun … 6=Sat
  const backDays = dow === 0 ? 6 : dow - 1;             // days back to Monday
  const mondayMs = aestMs - backDays * 24 * 60 * 60 * 1000;
  return new Date(mondayMs).toISOString().slice(0, 10);  // "YYYY-MM-DD"
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

/* ── Cached fetcher — re-runs when weekKey changes (Monday AEST) ──
   Strategy: list the Reports folder children, find the file by name
   (avoids Graph API's tilde-in-path-segment bug), then download by item ID. */
interface LiveReport { content: string; fetchedAt: string; weekKey: string }

const getCachedReport = unstable_cache(
  async (weekKey: string): Promise<LiveReport> => {
    const token = await getGraphToken();

    /* List the Reports folder to find the live file by name */
    const items = await listChildren(token, REPORT_BASE);
    const item  = items.find(f => (f.name as string) === LIVE_FILE);

    if (!item) {
      const names = items.map(f => f.name as string).join(", ");
      throw new Error(
        `"${LIVE_FILE}" not found in Reports folder. Items found: [${names || "none"}]`
      );
    }

    const content = await downloadById(token, item.id as string);
    return { content, fetchedAt: new Date().toISOString(), weekKey };
  },
  ["xtnl-live-report"],
  { revalidate: 86400 }   // daily background refresh; weekKey change forces immediate re-fetch
);

/* ── Route handler ──────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(session as { twoFactorVerified?: boolean } | null)?.twoFactorVerified)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const debug   = process.env.NODE_ENV === "development" &&
                  req.nextUrl.searchParams.get("debug") === "1";
  const weekKey = getMondayAESTKey();
  const log: string[] = [];

  try {
    log.push(`Week key (Monday AEST): ${weekKey}`);
    log.push(`Fetching: ${LIVE_PATH} from OneDrive user ${USER_ID}`);

    const report = await getCachedReport(weekKey);

    log.push(`OK — ${report.content.length} chars, originally fetched ${report.fetchedAt}`);
    return NextResponse.json({
      content:    report.content,
      filename:   LIVE_FILE,
      reportDate: report.weekKey,
      fetchedAt:  report.fetchedAt,
      ...(debug ? { _log: log } : {}),
    });
  } catch (e) {
    console.error("[report GET]", e);
    log.push(`Error: ${String(e)}`);
    return NextResponse.json(
      { error: "Failed to load report. Please try again later.", ...(debug ? { _log: log } : {}) },
      { status: 500 }
    );
  }
}
