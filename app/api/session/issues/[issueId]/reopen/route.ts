import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

/** POST — reopen an issue from 'staging' or 'archived' back to 'open'.
 *  Each reopen escalates priority by one step (priority - 1, min 0 = DIRE).
 *  The solution's observed-resolve checkboxes are cleared so the 3-week
 *  observation cycle restarts fresh. */
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

  /* Fetch the current issue */
  const { data: issue, error: fetchErr } = await supabase
    .from("issues")
    .select("issue_id, status, priority, reopen_count")
    .eq("issue_id", issueId)
    .single();

  if (fetchErr || !issue)
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  if (issue.status !== "staging" && issue.status !== "archived")
    return NextResponse.json({ error: "Only staging or archived issues can be reopened" }, { status: 400 });

  const priority_before = issue.priority as number;
  const priority_after  = Math.max(0, priority_before - 1); // escalate: lower number = more urgent

  const reopened_by = (session as any).userEmail ?? "unknown";

  /* Log the reopen event */
  await supabase.from("issue_reopens").insert({
    issue_id: issueId,
    reopened_by,
    previous_status: issue.status,
    priority_before,
    priority_after,
    reason,
  });

  /* Reset the issue to open with escalated priority */
  const { error: issueErr } = await supabase
    .from("issues")
    .update({
      status:       "open",
      priority:     priority_after,
      reopen_count: (issue.reopen_count as number) + 1,
      staging_at:   null,
    })
    .eq("issue_id", issueId);

  if (issueErr) return NextResponse.json({ error: issueErr.message }, { status: 500 });

  /* Clear only the active solution's observed-resolve checkboxes — scratched ones are immutable */
  await supabase
    .from("issue_solutions")
    .update({ observed_week_1: null, observed_week_2: null, observed_week_3: null, all_observed_at: null })
    .eq("issue_id", issueId)
    .eq("solution_status", "active");

  return NextResponse.json({ ok: true, priority_after });
}
