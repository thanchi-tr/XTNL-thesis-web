import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

/** PATCH — mark an observed-resolve week (1, 2, or 3).
 *  Weeks must be checked in order. When week 3 is checked the issue
 *  transitions to 'staging' (21-day observation window begins). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const roles: string[] = (session as any).roles ?? [];
  if (!roles.some(r => ["strategist", "fund_manager"].includes(r)))
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });

  const { issueId } = await params;
  const body = await req.json().catch(() => ({}));
  const week = body.week;
  if (week !== 1 && week !== 2 && week !== 3)
    return NextResponse.json({ error: "week must be 1, 2, or 3" }, { status: 400 });

  const { data: issue, error: fetchErr } = await supabase
    .from("issues")
    .select("current_solution, status")
    .eq("issue_id", issueId)
    .single();

  if (fetchErr || !issue)
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const sol = issue.current_solution as Record<string, any> | null;
  if (!sol?.id)
    return NextResponse.json({ error: "No active solution for this issue" }, { status: 404 });

  // Enforce sequential order
  if (week === 2 && !sol.observed_week_1)
    return NextResponse.json({ error: "Week 1 must be observed first" }, { status: 400 });
  if (week === 3 && (!sol.observed_week_1 || !sol.observed_week_2))
    return NextResponse.json({ error: "Weeks 1 and 2 must be observed first" }, { status: 400 });

  const now   = new Date().toISOString();
  const actor = (session as any).userEmail ?? "unknown";

  // Append SOLUTION_OBSERVED event
  const { error: evtErr } = await supabase.from("issue_events").insert({
    issue_id:   issueId,
    event_type: "SOLUTION_OBSERVED",
    actor,
    payload:    { week },
    created_at: now,
  });
  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });

  // Update denormalized solution snapshot
  const updatedSol = { ...sol, [`observed_week_${week}`]: now };
  const issueUpdate: Record<string, unknown> = { current_solution: updatedSol };

  // All 3 weeks observed → transition to staging
  if (week === 3) {
    updatedSol.all_observed_at = now;
    issueUpdate.status     = "staging";
    issueUpdate.staging_at = now;
  }

  const { error: updErr } = await supabase
    .from("issues")
    .update(issueUpdate)
    .eq("issue_id", issueId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
