import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";
import { randomUUID } from "crypto";

/** PUT — propose a new solution.
 *  Any existing active solution is scratched (written to the event log as history)
 *  before the new one is set as current_solution on the issue. */
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

  // Fetch current issue to read existing active solution (if any)
  const { data: issue, error: fetchErr } = await supabase
    .from("issues")
    .select("current_solution, status")
    .eq("issue_id", issueId)
    .single();

  if (fetchErr || !issue)
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const existing = issue.current_solution as Record<string, any> | null;

  // If an active solution exists, append a SOLUTION_SCRATCHED event for history
  if (existing?.id) {
    await supabase.from("issue_events").insert({
      issue_id:   issueId,
      event_type: "SOLUTION_SCRATCHED",
      actor:      proposed_by,
      payload: {
        solution_id:  existing.id,
        description:  existing.description,
        proposed_by:  existing.proposed_by,
        scratched_at: now,
        scratched_by: proposed_by,
      },
      created_at: now,
    });
  }

  // Build the new active solution snapshot
  const newSolutionId = randomUUID();
  const newSolution = {
    id:              newSolutionId,
    description,
    proposed_by,
    created_at:      now,
    endorsements:    0,
    disregards:      0,
    votes:           0,
    observed_week_1: null,
    observed_week_2: null,
    observed_week_3: null,
    all_observed_at: null,
  };

  // Append SOLUTION_PROPOSED event
  const { error: evtErr } = await supabase.from("issue_events").insert({
    issue_id:   issueId,
    event_type: "SOLUTION_PROPOSED",
    actor:      proposed_by,
    payload: { solution_id: newSolutionId, description, proposed_by },
    created_at: now,
  });
  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });

  // Update issue: set new current_solution + advance to in_progress if still open
  const statusUpdate: Record<string, unknown> = { current_solution: newSolution };
  if (issue.status === "open") statusUpdate.status = "in_progress";

  const { error: updErr } = await supabase
    .from("issues")
    .update(statusUpdate)
    .eq("issue_id", issueId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, solution_id: newSolutionId });
}

/** DELETE — scratch the active solution and revert issue to open. */
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
    .select("current_solution, status")
    .eq("issue_id", issueId)
    .single();

  if (fetchErr || !issue)
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const existing = issue.current_solution as Record<string, any> | null;
  if (!existing?.id)
    return NextResponse.json({ error: "No active solution to scratch" }, { status: 404 });

  // Append SOLUTION_SCRATCHED event
  const { error: evtErr } = await supabase.from("issue_events").insert({
    issue_id:   issueId,
    event_type: "SOLUTION_SCRATCHED",
    actor:      scratched_by,
    payload: {
      solution_id:  existing.id,
      description:  existing.description,
      proposed_by:  existing.proposed_by,
      scratched_at: now,
      scratched_by,
    },
    created_at: now,
  });
  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });

  // Clear current_solution and revert issue to open
  const { error: updErr } = await supabase
    .from("issues")
    .update({
      current_solution: null,
      ...(issue.status === "in_progress" ? { status: "open" } : {}),
    })
    .eq("issue_id", issueId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
