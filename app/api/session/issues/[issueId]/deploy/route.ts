import { NextResponse, type NextRequest } from "next/server";
import { auth }      from "@/auth";
import { supabase }  from "@/lib/supabase";

/** POST — Strategist deploys a Digital Tool against an issue.
 *  body: { tool_id: string, activate?: boolean }
 *    activate=false → TOOL_QUEUED   (selected, deployment pending)
 *    activate=true  → OOS_VALIDATION (live; the OOS session clock starts now)
 *  The Operator is never permitted here — separation of duties is absolute.  */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const roles: string[] = (session as any).roles ?? [];
  if (!roles.some(r => ["strategist", "fund_manager"].includes(r)))
    return NextResponse.json({ error: "Strategist role required" }, { status: 403 });

  const { issueId } = await params;
  const body     = await req.json().catch(() => ({}));
  const tool_id  = typeof body.tool_id === "string" ? body.tool_id : "";
  const activate = body.activate === true;
  if (!tool_id) return NextResponse.json({ error: "tool_id required" }, { status: 400 });

  const [{ data: issue }, { data: tool }] = await Promise.all([
    supabase.from("issues").select("issue_id, kms_status, status").eq("issue_id", issueId).single(),
    supabase.from("digital_tools").select("tool_id, name, version, deprecated").eq("tool_id", tool_id).single(),
  ]);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  if (!tool)  return NextResponse.json({ error: "Tool not found in registry" }, { status: 404 });
  if (tool.deprecated)
    return NextResponse.json({ error: "Tool is deprecated — re-engineer or select another" }, { status: 422 });

  const actor = (session as any).userEmail ?? "unknown";
  const now   = new Date().toISOString();

  // Deactivate any previous deployment on this issue, then link the new one.
  await supabase.from("tool_deployments").update({ active: false }).eq("issue_id", issueId).eq("active", true);
  const { error: depErr } = await supabase.from("tool_deployments").insert({
    tool_id, issue_id: issueId, deployed_by: actor, deployed_at: now, active: true,
  });
  if (depErr) return NextResponse.json({ error: depErr.message }, { status: 500 });

  const kms_status = activate ? "OOS_VALIDATION" : "TOOL_QUEUED";
  const { error: updErr } = await supabase
    .from("issues")
    .update({
      kms_status,
      status: activate ? "staging" : "in_progress",   // legacy mirror
      ...(activate ? { oos_started_at: now, staging_at: now, baseline_at: null } : {}),
    })
    .eq("issue_id", issueId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await supabase.from("issue_events").insert({
    issue_id:   issueId,
    event_type: "TOOL_DEPLOYED",
    actor,
    payload: { tool_id, tool_name: tool.name, tool_version: tool.version, activated: activate },
    created_at: now,
  });

  return NextResponse.json({ ok: true, kms_status });
}

/** PATCH — activate the queued deployment (TOOL_QUEUED → OOS_VALIDATION). */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const roles: string[] = (session as any).roles ?? [];
  if (!roles.some(r => ["strategist", "fund_manager"].includes(r)))
    return NextResponse.json({ error: "Strategist role required" }, { status: 403 });

  const { issueId } = await params;
  const now = new Date().toISOString();

  const { data: issue } = await supabase
    .from("issues").select("issue_id, kms_status").eq("issue_id", issueId).single();
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  if (issue.kms_status !== "TOOL_QUEUED")
    return NextResponse.json({ error: "Only TOOL_QUEUED issues can enter OOS validation" }, { status: 400 });

  const { error } = await supabase
    .from("issues")
    .update({ kms_status: "OOS_VALIDATION", status: "staging", oos_started_at: now, staging_at: now })
    .eq("issue_id", issueId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("issue_events").insert({
    issue_id: issueId, event_type: "OOS_STARTED",
    actor: (session as any).userEmail ?? "unknown", payload: {}, created_at: now,
  });

  return NextResponse.json({ ok: true, kms_status: "OOS_VALIDATION" });
}
