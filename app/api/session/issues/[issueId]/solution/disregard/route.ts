import { NextResponse, type NextRequest } from "next/server";
import { auth }     from "@/auth";
import { supabase } from "@/lib/supabase";

/** POST — disregard the active solution for an issue. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const roles: string[] = (session as any).roles ?? [];
  if (!roles.some(r => ["operator", "analyst", "strategist", "fund_manager"].includes(r)))
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });

  const { issueId } = await params;
  const actor = (session as any).userEmail ?? "unknown";

  const { data: issue, error: fetchErr } = await supabase
    .from("issues")
    .select("current_solution")
    .eq("issue_id", issueId)
    .single();

  if (fetchErr || !issue?.current_solution)
    return NextResponse.json({ error: "No active solution found" }, { status: 404 });

  const sol = issue.current_solution as Record<string, any>;

  // Append event to the audit log
  await supabase.from("issue_events").insert({
    issue_id:   issueId,
    event_type: "SOLUTION_DISREGARDED",
    actor,
    payload:    { solution_id: sol.id, disregarder: actor },
  });

  // Increment denormalized counter in current_solution JSONB
  const disregards = (sol.disregards ?? 0) + 1;
  const { error: updErr } = await supabase
    .from("issues")
    .update({ current_solution: { ...sol, disregards } })
    .eq("issue_id", issueId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, disregards });
}
