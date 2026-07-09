import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

/** PUT — add or replace the solution for an issue.
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

  /* Upsert — replaces any existing solution for this issue */
  const { error: solErr } = await supabase
    .from("issue_solutions")
    .upsert(
      { issue_id: issueId, description, proposed_by,
        observed_week_1: null, observed_week_2: null, observed_week_3: null, all_observed_at: null },
      { onConflict: "issue_id" }
    );
  if (solErr) return NextResponse.json({ error: solErr.message }, { status: 500 });

  /* Advance issue to in_progress if it was still open */
  await supabase
    .from("issues")
    .update({ status: "in_progress" })
    .eq("issue_id", issueId)
    .eq("status", "open");

  return NextResponse.json({ ok: true });
}
