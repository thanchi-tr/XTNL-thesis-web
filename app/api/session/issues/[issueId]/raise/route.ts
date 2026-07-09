import { NextResponse }    from "next/server";
import { auth }             from "@/auth";
import { supabase }         from "@/lib/supabase";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { issueId } = await params;
  const raised_by = (session as any).userEmail ?? "unknown";

  /* Upsert — silently ignores duplicate raises via the UNIQUE constraint */
  const { error } = await supabase
    .from("issue_raises")
    .upsert({ issue_id: issueId, raised_by }, { onConflict: "issue_id,raised_by", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
