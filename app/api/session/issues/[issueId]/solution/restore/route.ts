import { NextResponse, type NextRequest } from "next/server";
import { auth }             from "@/auth";
import { supabase }         from "@/lib/supabase";
import { getMondayAESTKey } from "@/lib/weekKey";
import { scratchActive, type Solution } from "@/lib/solutions";

/** POST — restore a previously scratched solution back to active.
 *  Demotes whatever is currently active (if anything) to scratched first —
 *  the same "at most one active" rule PUT enforces. Re-tags week_tag to the
 *  current week: restoring means "this is the week's assigned solution
 *  again", the same as a fresh proposal. */
export async function POST(
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
  const solutionId = typeof body.solution_id === "string" ? body.solution_id : "";
  if (!solutionId) return NextResponse.json({ error: "solution_id required" }, { status: 400 });

  const actor = (session as any).userEmail ?? "unknown";
  const now   = new Date().toISOString();

  const { data: issue, error: fetchErr } = await supabase
    .from("issues")
    .select("solutions, status")
    .eq("issue_id", issueId)
    .single();

  if (fetchErr || !issue) {
    if (fetchErr) console.error("[solution restore] fetch failed", fetchErr);
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const existing = (issue.solutions as Solution[] | null) ?? [];
  const target = existing.find(s => s.id === solutionId);
  if (!target)
    return NextResponse.json({ error: "Solution not found" }, { status: 404 });
  if (target.status === "active")
    return NextResponse.json({ error: "Solution is already active" }, { status: 400 });

  const demoted = scratchActive(existing, actor, now);
  const nextSolutions = demoted.map(s =>
    s.id === solutionId
      ? { ...s, status: "active" as const, scratched_at: null, scratched_by: null, week_tag: getMondayAESTKey() }
      : s
  );

  const { error: evtErr } = await supabase.from("issue_events").insert({
    issue_id:   issueId,
    event_type: "SOLUTION_RESTORED",
    actor,
    payload:    { solution_id: solutionId, description: target.description },
    created_at: now,
  });
  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });

  const statusUpdate: Record<string, unknown> = { solutions: nextSolutions };
  if (issue.status === "open") statusUpdate.status = "in_progress";

  const { error: updErr } = await supabase
    .from("issues")
    .update(statusUpdate)
    .eq("issue_id", issueId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
