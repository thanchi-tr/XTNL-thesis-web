import { NextResponse, type NextRequest } from "next/server";
import { auth }     from "@/auth";
import { supabase } from "@/lib/supabase";

/** POST — increment vote count on the active solution for an issue.
 *  Accessible to any authenticated operator / analyst / strategist / fund_manager. */
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

  /* Find active solution for this issue */
  const { data: sol, error: fetchErr } = await supabase
    .from("issue_solutions")
    .select("solution_id, votes")
    .eq("issue_id", issueId)
    .eq("solution_status", "active")
    .single();

  if (fetchErr || !sol)
    return NextResponse.json({ error: "No active solution found" }, { status: 404 });

  const { error: updateErr } = await supabase
    .from("issue_solutions")
    .update({ votes: (sol.votes ?? 0) + 1 })
    .eq("solution_id", sol.solution_id);

  if (updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, votes: (sol.votes ?? 0) + 1 });
}
