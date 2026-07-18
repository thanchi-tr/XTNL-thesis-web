import { NextResponse }     from "next/server";
import { auth }             from "@/auth";
import { supabase }         from "@/lib/supabase";
import { getMondayAESTKey } from "@/lib/weekKey";
import type { Session }     from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
}

/* GET — has the analyst signed off this week's review? Any authenticated,
   2FA-verified user can read this (the copy button on both the session and
   analytics pages needs it); only "analyst" can create the sign-off (POST). */
export async function GET() {
  try {
    const session = await auth() as Session | null;
    if (!getAuthedSession(session))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const weekKey = getMondayAESTKey();
    const { data, error } = await supabase
      .from("analyst_weekly_signoff")
      .select("signed_off_by, signed_off_at")
      .eq("week_key", weekKey)
      .maybeSingle();

    if (error) {
      console.error("[weekly-signoff GET]", error);
      return NextResponse.json({ error: "Failed to load sign-off status." }, { status: 500 });
    }

    return NextResponse.json({
      signedOff:   !!data,
      signedOffBy: data?.signed_off_by ?? null,
      signedOffAt: data?.signed_off_at ?? null,
      weekKey,
    });
  } catch (e) {
    console.error("[weekly-signoff GET] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/* POST — analyst marks this week's review complete. Idempotent: clicking
   again just refreshes signed_off_by/signed_off_at via upsert. */
export async function POST() {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = authed.roles ?? [];
    if (!roles.includes("analyst"))
      return NextResponse.json({ error: "Forbidden — analyst role required" }, { status: 403 });

    const weekKey = getMondayAESTKey();
    const { data, error } = await supabase
      .from("analyst_weekly_signoff")
      .upsert({ week_key: weekKey, signed_off_by: authed.userEmail }, { onConflict: "week_key" })
      .select()
      .single();

    if (error) {
      console.error("[weekly-signoff POST] supabase error", error);
      return NextResponse.json({ error: "Failed to record sign-off." }, { status: 500 });
    }

    return NextResponse.json({ row: data }, { status: 201 });
  } catch (e) {
    console.error("[weekly-signoff POST] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
