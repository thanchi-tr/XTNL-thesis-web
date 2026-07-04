import { NextResponse }    from "next/server";
import { auth }             from "@/auth";
import { unstable_cache }   from "next/cache";
import { getMondayAESTKey } from "@/lib/weekKey";

const TENANT_ID     = process.env.AZURE_TENANT_ID!;
const CLIENT_ID     = process.env.AZURE_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;
const USER_ID       = process.env.ONEDRIVE_USER_ID!;
const REPORT_BASE   = (process.env.REPORT_BASE_URL ?? "XTNLSolutions/Operations/Reports")
  .replace(/^["']|["']$/g, "")
  .replace(/\/$/, "");
const AUDIT_FILE    = "live.audit.txt";

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

interface AuditReport { content: string; fetchedAt: string; weekKey: string }

/* Cached — re-fetches only when Monday AEST date changes (same strategy as /api/data/report) */
const getCachedAuditReport = unstable_cache(
  async (weekKey: string): Promise<AuditReport> => {
    const token = await getGraphToken();

    /* List folder to find file by name (avoids Graph path/tilde bugs) */
    const listUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(USER_ID)}/drive/root:/${REPORT_BASE}:/children?$top=100&$select=id,name`;
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!listRes.ok) throw new Error(`Graph list ${listRes.status}`);
    const { value = [] } = await listRes.json() as { value?: { id: string; name: string }[] };

    const item = value.find(f => f.name === AUDIT_FILE);
    if (!item) throw new Error(`"${AUDIT_FILE}" not found in Reports folder`);

    /* Download by item ID */
    const dlUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(USER_ID)}/drive/items/${item.id}/content`;
    const dlRes = await fetch(dlUrl, { headers: { Authorization: `Bearer ${token}` }, redirect: "follow" });
    if (!dlRes.ok) throw new Error(`Graph download ${dlRes.status}`);

    return { content: await dlRes.text(), fetchedAt: new Date().toISOString(), weekKey };
  },
  ["xtnl-audit-report"],
  { revalidate: 86400 }
);

export async function GET() {
  const session = await auth();
  if (!(session as { twoFactorVerified?: boolean } | null)?.twoFactorVerified)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const report = await getCachedAuditReport(getMondayAESTKey());
    return new NextResponse(report.content, {
      status:  200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Fetched-At": report.fetchedAt,
        "X-Week-Key":   report.weekKey,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
