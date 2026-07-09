import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

/** PATCH — mark an observed-resolve week (1, 2, or 3) on the issue's solution.
 *  Weeks must be checked in order: can't check W2 before W1, etc.
 *  Only strategist / fund_manager may observe resolutions.
 *  When all 3 weeks are checked the DB trigger transitions the issue to 'staging'. */
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

  /* Fetch the active solution only — scratched ones must not be modified */
  const { data: sol, error: fetchErr } = await supabase
    .from("issue_solutions")
    .select("solution_id, observed_week_1, observed_week_2, observed_week_3")
    .eq("issue_id", issueId)
    .eq("solution_status", "active")
    .single();

  if (fetchErr || !sol)
    return NextResponse.json({ error: "No solution found for this issue" }, { status: 404 });

  /* Enforce order: can't check week N if week N-1 is null */
  if (week === 2 && !sol.observed_week_1)
    return NextResponse.json({ error: "Week 1 must be observed first" }, { status: 400 });
  if (week === 3 && (!sol.observed_week_1 || !sol.observed_week_2))
    return NextResponse.json({ error: "Weeks 1 and 2 must be observed first" }, { status: 400 });

  const col = `observed_week_${week}` as const;
  const now = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("issue_solutions")
    .update({ [col]: now })
    .eq("solution_id", sol.solution_id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
