import { NextResponse }     from "next/server";
import { auth }             from "@/auth";
import { supabase }         from "@/lib/supabase";
import { toKmsStatus }      from "@/lib/kms";
import { getMondayAESTKey } from "@/lib/weekKey";
import { activeSolution, type Solution } from "@/lib/solutions";

/* ── Lightweight polling signal for the operator view ─────────────────────
   Deliberately NOT the full /api/session/issues payload (that route already
   does 4 parallel queries + in-memory joins for the full panel) — this is
   meant to be polled every ~60s from the session page regardless of
   whether the Issues panel is even open, so it only pulls the handful of
   columns actually needed to answer two yes/no questions:
     - is there an active SEV1 (priority 0-1) issue open right now that
       still needs attention?
     - is there an active Biological Substrate → Visual Fatigue issue open?
   "Active" mirrors the same definition IssuePanel already uses for its
   Triage badge count (TRIAGE_PENDING / RELAPSED / TOOL_QUEUED).

   A SEV1 issue stops counting toward sev1Active — the banner clears — once
   it either: is archived (excluded by the .neq("status", "archived")
   filter below — "resolved completely"), OR has an active solution whose
   week_tag matches the current week ("has a weekly solution assigned").
   A stale solution from a prior week does NOT clear it — that's the whole
   point of week_tag existing. */
const ACTIVE_KMS = new Set(["TRIAGE_PENDING", "RELAPSED", "TOOL_QUEUED"]);

export async function GET() {
  const session = await auth();
  if (!session?.twoFactorVerified)
    return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { data, error } = await supabase
    .from("issues")
    .select("priority, status, kms_status, domain, subsystem, solutions")
    .neq("status", "archived");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const currentWeek = getMondayAESTKey();
  let sev1Active = false;
  let visualFatigueActive = false;

  for (const i of data ?? []) {
    if (!ACTIVE_KMS.has(toKmsStatus(i.kms_status, i.status))) continue;

    if (i.priority <= 1) {
      const active = activeSolution((i.solutions as Solution[] | null) ?? []);
      const addressedThisWeek = !!active && active.week_tag === currentWeek;
      if (!addressedThisWeek) sev1Active = true;
    }
    if (i.domain === "biological" && i.subsystem === "visual_fatigue") visualFatigueActive = true;
    if (sev1Active && visualFatigueActive) break;
  }

  return NextResponse.json({ sev1Active, visualFatigueActive });
}
