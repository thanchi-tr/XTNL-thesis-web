import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";
import {
  isValidTaxonomyPath, toKmsStatus, tradingSessionsSince, OOS_SESSIONS_REQUIRED,
} from "@/lib/kms";

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

  const [
    { data: issues, error: issErr },
    { data: scratchedEvents, error: evtErr },
    { data: deployments, error: depErr },
    { data: tools, error: toolErr },
  ] = await Promise.all([
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
    supabase.from("tool_deployments").select("*").order("deployed_at", { ascending: false }),
    supabase.from("digital_tools").select("tool_id, name, category, version, deprecated"),
  ]);

  if (issErr) return NextResponse.json({ error: issErr.message }, { status: 500 });
  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });
  // Tool tables may not exist until the KMS migration runs — degrade gracefully.
  const deps     = depErr  ? [] : (deployments ?? []);
  const toolRows = toolErr ? [] : (tools ?? []);
  const toolMap  = new Map(toolRows.map(t => [t.tool_id, t]));

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

  const depMap = new Map<string, any[]>();
  for (const d of deps) {
    const t = toolMap.get(d.tool_id);
    const arr = depMap.get(d.issue_id) ?? [];
    arr.push({
      deployment_id: d.id,
      tool_id:       d.tool_id,
      tool_name:     t?.name ?? "unknown tool",
      tool_version:  t?.version ?? "",
      tool_category: t?.category ?? "",
      deployed_at:   d.deployed_at,
      deployed_by:   d.deployed_by,
      active:        d.active,
      relapses:      d.relapses ?? 0,
    });
    depMap.set(d.issue_id, arr);
  }

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

  /* OOS auto-promotion — time-decay on surviving trading sessions. No manual
     closing exists: the system itself promotes OOS_VALIDATION issues that have
     survived the required session count without a relapse. */
  const now = new Date();
  const promote: string[] = [];

  const merged = topLevel.map((i: any) => {
    const sol: CurrentSolution | null = i.current_solution ?? null;
    let kms = toKmsStatus(i.kms_status, i.status);
    const oosStart = i.oos_started_at ?? i.staging_at ?? null;
    const oosSessions = kms === "OOS_VALIDATION" && oosStart ? tradingSessionsSince(oosStart, now) : 0;
    const stagingMs = i.staging_at ? new Date(i.staging_at).getTime() : null;
    const stagingDaysRemaining =
      i.status === "staging" && stagingMs
        ? Math.max(0, Math.ceil((stagingMs + 21 * 86_400_000 - now.getTime()) / 86_400_000))
        : null;

    if (kms === "OOS_VALIDATION" && oosSessions >= OOS_SESSIONS_REQUIRED) {
      kms = "BASELINE_RESTORED";
      promote.push(i.issue_id);
    }

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
      status:                 i.status,
      staging_at:             i.staging_at           ?? null,
      staging_days_remaining: stagingDaysRemaining,
      kms_status:             kms,
      domain:                 i.domain               ?? null,
      subsystem:              i.subsystem            ?? null,
      leaf_node:              i.leaf_node            ?? null,
      oos_started_at:         oosStart,
      oos_sessions:           oosSessions,
      oos_sessions_required:  OOS_SESSIONS_REQUIRED,
      baseline_at:            i.baseline_at          ?? null,
      raise_count:            i.raise_count          ?? 0,
      reopen_count:           i.reopen_count         ?? 0,
      created_at:             i.created_at,
      closed_at:              i.closed_at            ?? null,
      resolution_note:        i.resolution_note      ?? null,
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
      deployments:            depMap.get(i.issue_id) ?? [],
      sub_issues:             subMap.get(i.issue_id) ?? [],
    };
  });

  // Persist promotions (best-effort; the response already reflects them)
  if (promote.length > 0) {
    await supabase
      .from("issues")
      .update({ kms_status: "BASELINE_RESTORED", status: "archived", baseline_at: now.toISOString() })
      .in("issue_id", promote);
  }

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
  const title       = typeof body.title       === "string" ? body.title.trim().slice(0, 200)        : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null;
  const priority    = typeof body.priority    === "number"
    ? Math.max(0, Math.min(5, Math.round(body.priority))) : 3;
  const impact_score = typeof body.impact_score === "number"
    ? Math.max(1, Math.min(10, Math.round(body.impact_score))) : 5;
  const parent_issue_id =
    typeof body.parent_issue_id === "string" && body.parent_issue_id ? body.parent_issue_id : null;

  /* ── Absolute Taxonomic Lockout ────────────────────────────────────────────
     No free-text categorisation exists. The submission is rejected unless the
     Domain → Sub-System → Leaf path is an exact node of the ontology tree.  */
  const domain    = typeof body.domain    === "string" ? body.domain    : "";
  const subsystem = typeof body.subsystem === "string" ? body.subsystem : "";
  const leaf_node = typeof body.leaf_node === "string" ? body.leaf_node : "";
  if (!isValidTaxonomyPath(domain, subsystem, leaf_node))
    return NextResponse.json(
      { error: "Taxonomic lockout: a verified Leaf Node from the ontology is required." },
      { status: 422 },
    );
  if (Array.isArray(body.tags) && body.tags.length > 0)
    return NextResponse.json(
      { error: "Zero-trust metadata: free-text tags are not accepted." },
      { status: 422 },
    );

  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const reported_by   = (session as any).userEmail ?? "unknown";
  const reporter_role = roles[0] ?? null;

  const { data, error } = await supabase
    .from("issues")
    .insert({
      title, description, reported_by, reporter_role, priority, impact_score,
      parent_issue_id,
      // category intentionally omitted: it's a legacy column left over from
      // before the Domain/Sub-System/Leaf taxonomy existed, still carrying a
      // check constraint (issues_category_check) scoped to that old, now-
      // defunct vocabulary. Writing the new TAXONOMY domain ids (e.g.
      // "hardware") into it violates that constraint on every insert. The
      // real classification is domain/subsystem/leaf_node below, validated
      // server-side by isValidTaxonomyPath() — category isn't needed to
      // classify anything anymore. See supabase/issues_category_check_migration.sql
      // to drop the stale constraint at the DB layer too.
      tags:       [],
      domain, subsystem, leaf_node,
      kms_status: "TRIAGE_PENDING",
      status:     "open",
    })
    .select("issue_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ issue_id: data.issue_id }, { status: 201 });
}
