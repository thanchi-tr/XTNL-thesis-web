import { NextResponse, type NextRequest } from "next/server";
import { auth }             from "@/auth";
import { supabase }         from "@/lib/supabase";
import { randomUUID }       from "crypto";
import { getMondayAESTKey } from "@/lib/weekKey";
import { scratchActive, type Solution } from "@/lib/solutions";

/** PUT — propose a new solution.
 *  Any existing active solution is marked scratched IN PLACE (stays in the
 *  `solutions` array, not moved out to an event-log-only history) so it can
 *  later be restored. The new solution is appended as the active one,
 *  tagged with the current week — see lib/solutions.ts. */
export async function PUT(
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
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
  if (!description) return NextResponse.json({ error: "Description required" }, { status: 400 });

  const proposed_by = (session as any).userEmail ?? "unknown";
  const now         = new Date().toISOString();

  const { data: issue, error: fetchErr } = await supabase
    .from("issues")
    .select("solutions, status")
    .eq("issue_id", issueId)
    .single();

  if (fetchErr || !issue) {
    if (fetchErr) console.error("[solution route] fetch failed", fetchErr);
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const existing = (issue.solutions as Solution[] | null) ?? [];

  // Log the outgoing active solution (if any) for the audit trail — the
  // array itself, not this event, is now the source of truth for display.
  const outgoing = existing.find(s => s.status === "active");
  if (outgoing) {
    await supabase.from("issue_events").insert({
      issue_id:   issueId,
      event_type: "SOLUTION_SCRATCHED",
      actor:      proposed_by,
      payload: {
        solution_id:  outgoing.id,
        description:  outgoing.description,
        proposed_by:  outgoing.proposed_by,
        scratched_at: now,
        scratched_by: proposed_by,
      },
      created_at: now,
    });
  }

  const newSolution: Solution = {
    id:              randomUUID(),
    description,
    proposed_by,
    created_at:      now,
    week_tag:        getMondayAESTKey(),
    status:          "active",
    scratched_at:    null,
    scratched_by:    null,
    endorsements:    0,
    disregards:      0,
    votes:           0,
    observed_week_1: null,
    observed_week_2: null,
    observed_week_3: null,
    all_observed_at: null,
  };

  const nextSolutions = [...scratchActive(existing, proposed_by, now), newSolution];

  const { error: evtErr } = await supabase.from("issue_events").insert({
    issue_id:   issueId,
    event_type: "SOLUTION_PROPOSED",
    actor:      proposed_by,
    payload:    { solution_id: newSolution.id, description, proposed_by },
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
  return NextResponse.json({ ok: true, solution_id: newSolution.id });
}

/** DELETE — scratch the active solution (stays in the array, restorable)
 *  and revert the issue to open if nothing else is active. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const roles: string[] = (session as any).roles ?? [];
  if (!roles.some(r => ["strategist", "fund_manager"].includes(r)))
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });

  const { issueId } = await params;
  const scratched_by = (session as any).userEmail ?? "unknown";
  const now          = new Date().toISOString();

  const { data: issue, error: fetchErr } = await supabase
    .from("issues")
    .select("solutions, status")
    .eq("issue_id", issueId)
    .single();

  if (fetchErr || !issue) {
    if (fetchErr) console.error("[solution route] fetch failed", fetchErr);
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const existing = (issue.solutions as Solution[] | null) ?? [];
  const active = existing.find(s => s.status === "active");
  if (!active)
    return NextResponse.json({ error: "No active solution to scratch" }, { status: 404 });

  const { error: evtErr } = await supabase.from("issue_events").insert({
    issue_id:   issueId,
    event_type: "SOLUTION_SCRATCHED",
    actor:      scratched_by,
    payload: {
      solution_id:  active.id,
      description:  active.description,
      proposed_by:  active.proposed_by,
      scratched_at: now,
      scratched_by,
    },
    created_at: now,
  });
  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });

  const { error: updErr } = await supabase
    .from("issues")
    .update({
      solutions: scratchActive(existing, scratched_by, now),
      ...(issue.status === "in_progress" ? { status: "open" } : {}),
    })
    .eq("issue_id", issueId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
