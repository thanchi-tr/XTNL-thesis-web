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

    const COR_FIELDS = ["cor_dir", "cor_lock", "cor_target", "cor_entry", "cor_rm"] as const;

    /* Run all queries in parallel: total trades + 5 per-field filled counts */
    const [totalRes, ...fieldRes] = await Promise.all([
      supabase.from("trades").select("trade_id", { count: "exact", head: true }).gte("entry", weekStart),
      ...COR_FIELDS.map(f =>
        supabase.from("trades").select("trade_id", { count: "exact", head: true }).gte("entry", weekStart).not(f, "is", null)
      ),
    ]);

    if (totalRes.error) throw new Error(totalRes.error.message);
    const errs = fieldRes.filter(r => r.error);
    if (errs.length) throw new Error(errs[0].error!.message);

    const totalTrades    = totalRes.count ?? 0;
    const totalFields    = totalTrades * COR_FIELDS.length;
    const processedFields = fieldRes.reduce((sum, r) => sum + (r.count ?? 0), 0);

    /* Trade-level done flags (for step gating) */
    const incompleteRes = await supabase
      .from("trades").select("trade_id", { count: "exact", head: true }).gte("entry", weekStart)
      .or("cor_lock.is.null,cor_dir.is.null,cor_target.is.null,cor_entry.is.null,cor_rm.is.null");
    if (incompleteRes.error) throw new Error(incompleteRes.error.message);

    const incompleteVal = incompleteRes.count ?? 0;
    const ingestionDone = totalTrades > 0;
    const processDone   = ingestionDone && incompleteVal === 0;

    return NextResponse.json({ ingestionDone, processDone, total: totalTrades, totalFields, processedFields, weekStart });
  } catch (e) {
    console.error("[pipeline-status GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
