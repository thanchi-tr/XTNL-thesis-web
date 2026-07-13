import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

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
    .select("issue_id, status, priority, reopen_count, current_solution")
    .eq("issue_id", issueId)
    .single();

  if (fetchErr || !issue)
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  if (issue.status !== "staging" && issue.status !== "archived")
    return NextResponse.json({ error: "Only staging or archived issues can be reopened" }, { status: 400 });

  const priority_before = issue.priority as number;
  const priority_after  = Math.max(0, priority_before - 1);
  const reopened_by     = (session as any).userEmail ?? "unknown";
  const now             = new Date().toISOString();

  // Append REOPENED event — full audit record
  const { error: evtErr } = await supabase.from("issue_events").insert({
    issue_id:   issueId,
    event_type: "REOPENED",
    actor:      reopened_by,
    payload: {
      reason,
      previous_status: issue.status,
      priority_before,
      priority_after,
    },
    created_at: now,
  });
  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });

  // Reset active solution observed weeks (the solution itself remains active)
  let updatedSolution = issue.current_solution
    ? {
        ...issue.current_solution,
        observed_week_1: null,
        observed_week_2: null,
        observed_week_3: null,
        all_observed_at: null,
      }
    : null;

  // Update issue entity: escalate priority, reset to open, clear staging timestamp
  const { error: issueErr } = await supabase
    .from("issues")
    .update({
      status:           "open",
      priority:         priority_after,
      reopen_count:     (issue.reopen_count as number) + 1,
      staging_at:       null,
      current_solution: updatedSolution,
    })
    .eq("issue_id", issueId);

  if (issueErr) return NextResponse.json({ error: issueErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, priority_after });
}
