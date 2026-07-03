import { NextResponse } from "next/server";
import { auth }         from "@/auth";
import { supabase }     from "@/lib/supabase";
import type { Session } from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

/* Monday 00:00 AEST expressed as a UTC ISO string.
   AEST = UTC+10; trades table stores entry as UTC timestamps. */
function getWeekStartUTC(): string {
  const DAY_MS  = 24 * 60 * 60 * 1000;
  const AEST_MS = 10 * 60 * 60 * 1000;
  const aestNow = Date.now() + AEST_MS;
  const dow      = new Date(aestNow).getUTCDay();        // 0=Sun … 6=Sat, in AEST
  const backDays = dow === 0 ? 6 : dow - 1;              // days since Monday
  const aestMondayMidnight = aestNow - (aestNow % DAY_MS) - backDays * DAY_MS;
  return new Date(aestMondayMidnight - AEST_MS).toISOString(); // convert back to UTC
}

export async function GET() {
  try {
    const session = await auth() as Session | null;
    if (!(session as AuthedSession | null)?.twoFactorVerified)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const weekStart = getWeekStartUTC();

    /* Any trade ingested this week? */
    const { count: total, error: e1 } = await supabase
      .from("trades")
      .select("id", { count: "exact", head: true })
      .gte("entry", weekStart);

    if (e1) throw new Error(e1.message);

    /* Any trade this week still has a null cor_* field? */
    const { count: incomplete, error: e2 } = await supabase
      .from("trades")
      .select("id", { count: "exact", head: true })
      .gte("entry", weekStart)
      .or("cor_lock.is.null,cor_dir.is.null,cor_target.is.null,cor_entry.is.null,cor_rm.is.null");

    if (e2) throw new Error(e2.message);

    const ingestionDone = (total      ?? 0) > 0;
    const processDone   = ingestionDone && (incomplete ?? 0) === 0;

    return NextResponse.json({ ingestionDone, processDone, weekStart });
  } catch (e) {
    console.error("[pipeline-status GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
