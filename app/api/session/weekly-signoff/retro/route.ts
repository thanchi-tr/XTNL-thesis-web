import { NextResponse }                             from "next/server";
import { auth }                                     from "@/auth";
import { supabase, OPERATOR_USER_ID }               from "@/lib/supabase";
import { getMondayAESTKey, getMondayAESTKeyWeeksAgo } from "@/lib/weekKey";
import type { Session }                             from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
}

const ALLOWED_ROLES = ["strategist", "fund_manager"];

// How far back to look for a missing analyst sign-off. Bounded deliberately —
// analyst_weekly_signoff is a new table, so an unbounded scan would flag
// every week before it existed as "missing" forever.
const RETRO_SIGNOFF_LOOKBACK_WEEKS = 4;

const WEEK_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isAuthorizedStrategist(authed: AuthedSession): boolean {
  const roles = authed.roles ?? [];
  return roles.some(r => ALLOWED_ROLES.includes(r));
}

/* GET — lists past weeks (within a bounded lookback) that have no
   analyst_weekly_signoff row. Strategist/fund_manager only — this
   surfaces an operational gap, not something every role should see. */
export async function GET() {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAuthorizedStrategist(authed))
      return NextResponse.json({ error: "Forbidden — strategist or fund_manager role required" }, { status: 403 });

    // Strictly before the current week — this feature never touches the
    // in-progress week, that's still the analyst's normal flow.
    const candidateWeeks = Array.from(
      { length: RETRO_SIGNOFF_LOOKBACK_WEEKS },
      (_, i) => getMondayAESTKeyWeeksAgo(i + 1)
    );

    const { data, error } = await supabase
      .from("analyst_weekly_signoff")
      .select("week_key")
      .in("week_key", candidateWeeks);

    if (error) {
      console.error("[weekly-signoff/retro GET]", error);
      return NextResponse.json({ error: "Failed to load sign-off status." }, { status: 500 });
    }

    const signedOffWeeks = new Set((data ?? []).map(r => r.week_key as string));
    const missingWeeks = candidateWeeks
      .filter(w => !signedOffWeeks.has(w))
      .map(weekKey => ({ weekKey }));

    return NextResponse.json({ missingWeeks });
  } catch (e) {
    console.error("[weekly-signoff/retro GET] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/* POST — strategist retroactively signs off a past week the analyst
   missed. Fills gaps only: rejects if the week is the current/a future
   week (not this feature's job) or already has a sign-off row (would
   destroy the original attribution). Also logs a visible audit comment —
   a strategist signing off on the analyst's behalf is exactly the kind
   of thing that needs a paper trail, not just a quiet DB row. */
export async function POST(req: Request) {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAuthorizedStrategist(authed))
      return NextResponse.json({ error: "Forbidden — strategist or fund_manager role required" }, { status: 403 });

    const body = await req.json().catch(() => ({})) as { weekKey?: unknown };
    const weekKey = body.weekKey;
    if (typeof weekKey !== "string" || !WEEK_KEY_RE.test(weekKey))
      return NextResponse.json({ error: "weekKey must be a YYYY-MM-DD string" }, { status: 400 });

    const currentWeekKey = getMondayAESTKey();
    if (weekKey >= currentWeekKey)
      return NextResponse.json({ error: "weekKey must be strictly before the current week" }, { status: 400 });

    const { data: existing, error: existingError } = await supabase
      .from("analyst_weekly_signoff")
      .select("week_key")
      .eq("week_key", weekKey)
      .maybeSingle();

    if (existingError) {
      console.error("[weekly-signoff/retro POST] lookup error", existingError);
      return NextResponse.json({ error: "Failed to check existing sign-off." }, { status: 500 });
    }
    if (existing)
      return NextResponse.json({ error: "This week already has a sign-off — nothing to fill in." }, { status: 400 });

    const { data, error } = await supabase
      .from("analyst_weekly_signoff")
      .insert({ week_key: weekKey, signed_off_by: authed.userEmail })
      .select()
      .single();

    if (error) {
      console.error("[weekly-signoff/retro POST] insert error", error);
      return NextResponse.json({ error: "Failed to record sign-off." }, { status: 500 });
    }

    // Audit comment — best-effort: a logging hiccup shouldn't undo a
    // sign-off that's already committed.
    try {
      const now    = new Date().toISOString();
      const userId = OPERATOR_USER_ID ?? (authed.user as { id?: string } | undefined)?.id;
      await supabase.from("comments").insert({
        content: `[Strategist Sign-off] Week of ${weekKey} retroactively signed off by ${authed.userEmail} — analyst sign-off was missing.`,
        created_at: now,
        Entry: now,
        ...(userId ? { user_id: userId } : {}),
      });
    } catch (e) {
      console.error("[weekly-signoff/retro POST] audit comment failed", e);
    }

    return NextResponse.json({ row: data }, { status: 201 });
  } catch (e) {
    console.error("[weekly-signoff/retro POST] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
