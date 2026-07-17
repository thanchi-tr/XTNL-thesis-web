import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

/** POST — RELAPSE confirmation.
 *  Invoked by the triage intercept (operator confirms a historical match) or by
 *  the Strategist observing containment failure. The issue reverts to an active
 *  threat: kms_status → RELAPSED, the append-only reopen_count increments, the
 *  OOS clock resets, and the active Digital Tool deployment's relapse telemetry
 *  degrades its global effectiveness score. No new issue row is ever created. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { issueId } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

  const { data: issue, error: fetchErr } = await supabase
    .from("issues")
    .select("issue_id, status, kms_status, priority, reopen_count, raise_count, current_solution")
    .eq("issue_id", issueId)
    .single();

  if (fetchErr || !issue)
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const priority_before = issue.priority as number;
  const priority_after  = Math.max(0, priority_before - 1);
  const reopened_by     = (session as any).userEmail ?? "unknown";
  const now             = new Date().toISOString();

  // Append REOPENED event — permanent audit record
  const { error: evtErr } = await supabase.from("issue_events").insert({
    issue_id:   issueId,
    event_type: "REOPENED",
    actor:      reopened_by,
    payload: {
      reason,
      previous_status:     issue.status,
      previous_kms_status: issue.kms_status ?? null,
      priority_before,
      priority_after,
    },
    created_at: now,
  });
  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });

  // Degrade the active tool deployment — it failed Out-of-Sample.
  const { data: activeDep } = await supabase
    .from("tool_deployments")
    .select("id, relapses, tool_id")
    .eq("issue_id", issueId)
    .eq("active", true)
    .order("deployed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeDep) {
    await supabase
      .from("tool_deployments")
      .update({ relapses: (activeDep.relapses ?? 0) + 1 })
      .eq("id", activeDep.id);
  }

  // Reset active solution observation state (legacy solution flow)
  const updatedSolution = issue.current_solution
    ? {
        ...issue.current_solution,
        observed_week_1: null,
        observed_week_2: null,
        observed_week_3: null,
        all_observed_at: null,
      }
    : null;

  // Revert to active threat. reopen_count only ever increments (DB-enforced).
  const { error: issueErr } = await supabase
    .from("issues")
    .update({
      status:           "open",
      kms_status:       "RELAPSED",
      priority:         priority_after,
      reopen_count:     (issue.reopen_count as number) + 1,
      raise_count:      (issue.raise_count  as number ?? 0) + 1,
      staging_at:       null,
      oos_started_at:   null,
      baseline_at:      null,
      current_solution: updatedSolution,
    })
    .eq("issue_id", issueId);

  if (issueErr) return NextResponse.json({ error: issueErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, kms_status: "RELAPSED", priority_after });
}
