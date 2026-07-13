import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

const VALID_CATEGORIES = [
  "execution", "risk", "technical", "compliance", "process", "market", "other",
] as const;

type CurrentSolution = {
  id:              string;
  description:     string;
  proposed_by:     string;
  created_at:      string;
  endorsements:    number;
  disregards:      number;
  votes:           number;
  observed_week_1: string | null;
  observed_week_2: string | null;
  observed_week_3: string | null;
  all_observed_at: string | null;
};

export async function GET() {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  // Single query for issues (current_solution is already denormalized as JSONB)
  // One additional query for scratched solution history from the event log
  const [{ data: issues, error: issErr }, { data: scratchedEvents, error: evtErr }] =
    await Promise.all([
      supabase
        .from("issues")
        .select("*")
        .order("priority",    { ascending: true  })
        .order("raise_count", { ascending: false })
        .order("created_at",  { ascending: false }),
      supabase
        .from("issue_events")
        .select("issue_id, payload, created_at")
        .eq("event_type", "SOLUTION_SCRATCHED")
        .order("created_at", { ascending: false }),
    ]);

  if (issErr) return NextResponse.json({ error: issErr.message }, { status: 500 });
  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });

  // Group scratched events by issue_id for O(1) lookup
  const scratchedMap = new Map<string, any[]>();
  for (const e of scratchedEvents ?? []) {
    const arr = scratchedMap.get(e.issue_id) ?? [];
    arr.push({
      solution_id:  e.payload?.solution_id ?? null,
      description:  e.payload?.description ?? "",
      proposed_by:  e.payload?.proposed_by ?? "unknown",
      created_at:   e.payload?.proposed_at ?? e.created_at,
      scratched_at: e.payload?.scratched_at ?? e.created_at,
      scratched_by: e.payload?.scratched_by ?? null,
    });
    scratchedMap.set(e.issue_id, arr);
  }

  // Partition sub-issues from top-level issues
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
    const sol: CurrentSolution | null = i.current_solution ?? null;

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
      issue_id:               i.issue_id,
      title:                  i.title,
      description:            i.description         ?? null,
      reported_by:            i.reported_by,
      reporter_role:          i.reporter_role        ?? null,
      priority:               i.priority,
      category:               i.category             ?? "other",
      impact_score:           i.impact_score         ?? 5,
      tags:                   i.tags                 ?? [],
      parent_issue_id:        i.parent_issue_id      ?? null,
      status:                 effectiveStatus,
      raise_count:            i.raise_count          ?? 0,
      reopen_count:           i.reopen_count         ?? 0,
      created_at:             i.created_at,
      staging_at:             i.staging_at           ?? null,
      staging_days_remaining: stagingDaysRemaining,
      closed_at:              i.closed_at            ?? null,
      resolution_note:        i.resolution_note      ?? null,
      // flatten current_solution JSONB → same shape the frontend already expects
      solution_id:            sol?.id                ?? null,
      solution_description:   sol?.description       ?? null,
      solution_proposed_by:   sol?.proposed_by       ?? null,
      solution_created_at:    sol?.created_at        ?? null,
      solution_votes:         sol?.votes             ?? 0,
      solution_endorsements:  sol?.endorsements      ?? 0,
      solution_disregards:    sol?.disregards        ?? 0,
      observed_week_1:        sol?.observed_week_1   ?? null,
      observed_week_2:        sol?.observed_week_2   ?? null,
      observed_week_3:        sol?.observed_week_3   ?? null,
      all_observed_at:        sol?.all_observed_at   ?? null,
      scratched_solutions:    scratchedMap.get(i.issue_id) ?? [],
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
