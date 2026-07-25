import { NextResponse }            from "next/server";
import { auth }                    from "@/auth";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import { getMondayAESTKeyWeeksAgo } from "@/lib/weekKey";
import type { Session }            from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
}

const SOP_ROLES = ["strategist", "fund_manager"];

/* GET — which SOP checklists are currently enforced. Not strictly
   week-scoped on read: whatever a strategist most recently submitted is
   "currently enforced" and shown as-is, regardless of whether the
   week_key it was filed under happens to be this week or next — a
   strategist planning ahead shouldn't produce a set that's invisible to
   operators until a specific calendar date arrives. Any 2FA-verified user
   can read this (operators need it too); only strategist/fund_manager can
   write it (POST below). */
export async function GET() {
  try {
    const session = await auth() as Session | null;
    if (!getAuthedSession(session))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: latest, error: latestErr } = await supabase
      .from("sop_enforcements")
      .select("week_key")
      .order("week_key", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) {
      console.error("[sop enforcements GET] latest lookup", latestErr);
      return NextResponse.json({ error: "Failed to load enforced SOPs." }, { status: 500 });
    }
    if (!latest) return NextResponse.json({ weekKey: null, sops: [] });

    const { data, error } = await supabase
      .from("sop_enforcements")
      .select("sop_id, sop_checklists(*)")
      .eq("week_key", latest.week_key);

    if (error) {
      console.error("[sop enforcements GET]", error);
      return NextResponse.json({ error: "Failed to load enforced SOPs." }, { status: 500 });
    }

    const rows = (data ?? [])
      .map(r => (Array.isArray(r.sop_checklists) ? r.sop_checklists[0] : r.sop_checklists))
      .filter(Boolean);

    return NextResponse.json({ weekKey: latest.week_key, sops: rows });
  } catch (e) {
    console.error("[sop enforcements GET] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/* POST — replace the enforced set with exactly the given sopIds, filed
   under *next* week's date for record-keeping (server-computed, never
   client-supplied), then log a comment summarising the change. Reads
   (GET above) don't filter by that date — this takes effect for
   operators immediately. Empty array is valid — clears the enforced set. */
export async function POST(req: Request) {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = authed.roles ?? [];
    if (!roles.some(r => SOP_ROLES.includes(r)))
      return NextResponse.json({ error: "Forbidden — strategist role required" }, { status: 403 });

    const body = await req.json().catch(() => null) as { sopIds?: unknown } | null;
    if (!Array.isArray(body?.sopIds))
      return NextResponse.json({ error: "sopIds must be an array" }, { status: 400 });

    const sopIds = [...new Set(
      body!.sopIds.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0)
    )];

    const weekKey = getMondayAESTKeyWeeksAgo(-1); // next week

    const { error: delErr } = await supabase.from("sop_enforcements").delete().eq("week_key", weekKey);
    if (delErr) {
      console.error("[sop enforcements POST] delete error", delErr);
      return NextResponse.json({ error: "Failed to update enforced SOPs." }, { status: 500 });
    }

    let titles: string[] = [];
    if (sopIds.length > 0) {
      const { data: sopRows, error: sopErr } = await supabase
        .from("sop_checklists")
        .select("id, title")
        .in("id", sopIds);
      if (sopErr) {
        console.error("[sop enforcements POST] lookup error", sopErr);
        return NextResponse.json({ error: "Failed to update enforced SOPs." }, { status: 500 });
      }
      titles = (sopRows ?? []).map(r => r.title as string);

      const { error: insErr } = await supabase.from("sop_enforcements").insert(
        (sopRows ?? []).map(r => ({ week_key: weekKey, sop_id: r.id, enforced_by: authed.userEmail }))
      );
      if (insErr) {
        console.error("[sop enforcements POST] insert error", insErr);
        return NextResponse.json({ error: "Failed to update enforced SOPs." }, { status: 500 });
      }
    }

    const now = new Date().toISOString();
    const summary = titles.length > 0
      ? `[SOP Enforcement] ${authed.userEmail} enforced ${titles.length} SOP checklist${titles.length !== 1 ? "s" : ""} for week of ${weekKey}: ${titles.join(", ")}`
      : `[SOP Enforcement] ${authed.userEmail} cleared all enforced SOP checklists for week of ${weekKey}`;
    const commentRow: Record<string, unknown> = { content: summary, created_at: now, Entry: now };
    if (OPERATOR_USER_ID) commentRow.user_id = OPERATOR_USER_ID;
    await supabase.from("comments").insert(commentRow);

    return NextResponse.json({ ok: true, weekKey, titles });
  } catch (e) {
    console.error("[sop enforcements POST] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
