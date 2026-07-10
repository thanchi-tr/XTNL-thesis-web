import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

/** POST — strategist manually closes an issue, bypassing the 3-week observation staging period.
 *  Sets closed_at, optional resolution_note, and transitions status → archived. */
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
  const resolution_note =
    typeof body.resolution_note === "string" ? body.resolution_note.trim().slice(0, 1000) : null;

  const { error } = await supabase
    .from("issues")
    .update({
      status:          "archived",
      closed_at:       new Date().toISOString(),
      resolution_note,
    })
    .eq("issue_id", issueId)
    .neq("status", "archived");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
