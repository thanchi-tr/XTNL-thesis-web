import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

const VALID_CATEGORIES = [
  "execution", "risk", "technical", "compliance", "process", "market", "other",
] as const;

export async function GET() {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const [{ data: issues, error: issErr }, { data: solutions, error: solErr }] = await Promise.all([
    supabase
      .from("issues")
      .select("*")
      .order("priority",    { ascending: true  })
      .order("raise_count", { ascending: false })
      .order("created_at",  { ascending: false }),
    supabase.from("issue_solutions").select("*"),
  ]);

  if (issErr) return NextResponse.json({ error: issErr.message }, { status: 500 });
  if (solErr) return NextResponse.json({ error: solErr.message }, { status: 500 });

  /* Partition solutions into active (one per issue) and scratched (many) */
  const activeMap    = new Map<string, any>();
  const scratchedMap = new Map<string, any[]>();
  for (const s of solutions ?? []) {
    const status = s.solution_status ?? "active";
    if (status === "active") {
      activeMap.set(s.issue_id, s);
    } else {
      const arr = scratchedMap.get(s.issue_id) ?? [];
      arr.push(s);
      scratchedMap.set(s.issue_id, arr);
    }
  }

  /* Separate sub-issues from top-level issues */
  const subMap    = new Map<string, any[]>();
  const topLevel: any[] = [];
  for (const i of issues ?? []) {
    if (i.parent_issue_id) {
      const arr = subMap.get(i.parent_issue_id) ?? [];
      arr.push({
        issue_id:    i.issue_id,
        title:       i.title,
        priority:    i.priority,
        category:    i.category ?? "other",
        status:      i.status,
        raise_count: i.raise_count,
        created_at:  i.created_at,
      });
      subMap.set(i.parent_issue_id, arr);
    } else {
      topLevel.push(i);
    }
  }

  const now = Date.now();
  const merged = topLevel.map((i: any) => {
    const sol      = activeMap.get(i.issue_id) ?? null;
    const scratched = (scratchedMap.get(i.issue_id) ?? [])
      .sort((a: any, b: any) =>
        new Date(b.scratched_at ?? b.created_at).getTime() -
        new Date(a.scratched_at ?? a.created_at).getTime()
      );
    const stagingMs = i.staging_at ? new Date(i.staging_at).getTime() : null;
    const effectiveStatus =
      i.status === "staging" && stagingMs && stagingMs + 21 * 86_400_000 <= now
        ? "archived"
        : i.status;
    const stagingDaysRemaining =
      i.status === "staging" && stagingMs
        ? Math.max(0, Math.ceil((stagingMs + 21 * 86_400_000 - now) / 86_400_000))
        : null;
    return {
      ...i,
      category:               i.category       ?? "other",
      impact_score:           i.impact_score   ?? 5,
      tags:                   i.tags           ?? [],
      parent_issue_id:        i.parent_issue_id ?? null,
      closed_at:              i.closed_at       ?? null,
      resolution_note:        i.resolution_note ?? null,
      status:                 effectiveStatus,
      staging_days_remaining: stagingDaysRemaining,
      solution_id:            sol?.solution_id     ?? null,
      solution_description:   sol?.description     ?? null,
      solution_proposed_by:   sol?.proposed_by     ?? null,
      solution_created_at:    sol?.created_at      ?? null,
      solution_votes:         sol?.votes           ?? 0,
      observed_week_1:        sol?.observed_week_1 ?? null,
      observed_week_2:        sol?.observed_week_2 ?? null,
      observed_week_3:        sol?.observed_week_3 ?? null,
      all_observed_at:        sol?.all_observed_at ?? null,
      scratched_solutions:    scratched,
      sub_issues:             subMap.get(i.issue_id) ?? [],
    };
  });

  return NextResponse.json(merged);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const roles: string[] = (session as any).roles ?? [];
  if (!roles.some(r => ["operator", "analyst", "strategist", "fund_manager"].includes(r)))
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title       = typeof body.title       === "string" ? body.title.trim().slice(0, 200)       : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null;
  const priority    = typeof body.priority    === "number"
    ? Math.max(0, Math.min(5, Math.round(body.priority))) : 3;
  const category    = VALID_CATEGORIES.includes(body.category) ? body.category : "other";
  const impact_score = typeof body.impact_score === "number"
    ? Math.max(1, Math.min(10, Math.round(body.impact_score))) : 5;
  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[])
        .filter((t): t is string => typeof t === "string")
        .map(t => t.trim().slice(0, 50))
        .filter(Boolean)
        .slice(0, 10)
    : [];
  const parent_issue_id =
    typeof body.parent_issue_id === "string" && body.parent_issue_id ? body.parent_issue_id : null;

  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const reported_by   = (session as any).userEmail ?? "unknown";
  const reporter_role = roles[0] ?? null;

  const { data, error } = await supabase
    .from("issues")
    .insert({ title, description, reported_by, reporter_role, priority, category, impact_score, tags, parent_issue_id })
    .select("issue_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ issue_id: data.issue_id }, { status: 201 });
}
