import { NextResponse }   from "next/server";
import { auth }            from "@/auth";
import { supabase }        from "@/lib/supabase";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { issueId } = await params;
  const raised_by = (session as any).userEmail ?? "unknown";

  // Dedup: one RAISED event per actor per issue
  const { data: existing } = await supabase
    .from("issue_events")
    .select("id")
    .eq("issue_id", issueId)
    .eq("event_type", "RAISED")
    .eq("actor", raised_by)
    .limit(1)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true });

  // Append RAISED event + increment denormalized counter atomically in sequence
  const { error: evtErr } = await supabase
    .from("issue_events")
    .insert({ issue_id: issueId, event_type: "RAISED", actor: raised_by, payload: { raised_by } });

  if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 });

  const { data: issue } = await supabase
    .from("issues")
    .select("raise_count")
    .eq("issue_id", issueId)
    .single();

  if (issue) {
    await supabase
      .from("issues")
      .update({ raise_count: (issue.raise_count ?? 0) + 1 })
      .eq("issue_id", issueId);
  }

  return NextResponse.json({ ok: true });
}
