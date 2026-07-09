import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

/** PUT — propose a new solution for an issue.
 *  Any existing active solution is first scratched (moved to history)
 *  before the new one is inserted.
 *  Only strategist / fund_manager may propose solutions. */
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
  const now = new Date().toISOString();

  /* Scratch any existing active solution — moves it to history */
  await supabase
    .from("issue_solutions")
    .update({ solution_status: "scratched", scratched_at: now, scratched_by: proposed_by })
    .eq("issue_id", issueId)
    .eq("solution_status", "active");

  /* Insert the new active solution */
  const { error: solErr } = await supabase
    .from("issue_solutions")
    .insert({
      issue_id: issueId, description, proposed_by,
      solution_status: "active",
      observed_week_1: null, observed_week_2: null, observed_week_3: null, all_observed_at: null,
    });
  if (solErr) return NextResponse.json({ error: solErr.message }, { status: 500 });

  /* Advance issue to in_progress if still open */
  await supabase
    .from("issues")
    .update({ status: "in_progress" })
    .eq("issue_id", issueId)
    .eq("status", "open");

  return NextResponse.json({ ok: true });
}

/** DELETE — scratch the current active solution (moves it to history).
 *  The issue reverts to 'open' so a new solution can be proposed. */
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
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("issue_solutions")
    .update({ solution_status: "scratched", scratched_at: now, scratched_by })
    .eq("issue_id", issueId)
    .eq("solution_status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /* Revert issue to 'open' — no active solution remains */
  await supabase
    .from("issues")
    .update({ status: "open" })
    .eq("issue_id", issueId)
    .in("status", ["in_progress"]);

  return NextResponse.json({ ok: true });
}
