import { NextResponse } from "next/server";
import { auth }         from "@/auth";
import { supabase }     from "@/lib/supabase";
import { toKmsStatus }  from "@/lib/kms";

/* ── Lightweight polling signal for the operator view ─────────────────────
   Deliberately NOT the full /api/session/issues payload (that route already
   does 4 parallel queries + in-memory joins for the full panel) — this is
   meant to be polled every ~60s from the session page regardless of
   whether the Issues panel is even open, so it only pulls the handful of
   columns actually needed to answer two yes/no questions:
     - is there an active SEV1 (priority 0-1) issue open right now?
     - is there an active Biological Substrate → Visual Fatigue issue open?
   "Active" mirrors the same definition IssuePanel already uses for its
   Triage badge count (TRIAGE_PENDING / RELAPSED / TOOL_QUEUED). */
const ACTIVE_KMS = new Set(["TRIAGE_PENDING", "RELAPSED", "TOOL_QUEUED"]);

export async function GET() {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { data, error } = await supabase
    .from("issues")
    .select("priority, status, kms_status, domain, subsystem")
    .neq("status", "archived");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sev1Active = false;
  let visualFatigueActive = false;

  for (const i of data ?? []) {
    if (!ACTIVE_KMS.has(toKmsStatus(i.kms_status, i.status))) continue;
    if (i.priority <= 1) sev1Active = true;
    if (i.domain === "biological" && i.subsystem === "visual_fatigue") visualFatigueActive = true;
    if (sev1Active && visualFatigueActive) break;
  }

  return NextResponse.json({ sev1Active, visualFatigueActive });
}
