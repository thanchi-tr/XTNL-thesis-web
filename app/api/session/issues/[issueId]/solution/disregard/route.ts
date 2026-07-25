import { NextResponse, type NextRequest } from "next/server";
import { auth }     from "@/auth";
import { supabase } from "@/lib/supabase";
import { activeSolution, type Solution } from "@/lib/solutions";

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
    .select("solutions")
    .eq("issue_id", issueId)
    .single();

  const solutions = (issue?.solutions as Solution[] | null) ?? [];
  const sol = activeSolution(solutions);
  if (fetchErr || !sol) {
    if (fetchErr) console.error("[solution disregard] fetch failed", fetchErr);
    return NextResponse.json({ error: "No active solution found" }, { status: 404 });
  }

  await supabase.from("issue_events").insert({
    issue_id:   issueId,
    event_type: "SOLUTION_DISREGARDED",
    actor,
    payload:    { solution_id: sol.id, disregarder: actor },
  });

  const disregards = (sol.disregards ?? 0) + 1;
  const nextSolutions = solutions.map(s => s.id === sol.id ? { ...s, disregards } : s);

  const { error: updErr } = await supabase
    .from("issues")
    .update({ solutions: nextSolutions })
    .eq("issue_id", issueId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, disregards });
}
