import { NextResponse } from "next/server";
import { auth }         from "@/auth";
import { supabase }     from "@/lib/supabase";
import type { Session } from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

/* PATCH — batch-update cor_* fields on multiple trades */
export async function PATCH(req: Request) {
  try {
    const session = await auth() as Session | null;
    const s = session as AuthedSession | null;
    if (!s?.twoFactorVerified)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      updates?: { trade_id: string; cor_dir?: boolean | null; cor_lock?: boolean | null; cor_target?: boolean | null; cor_entry?: boolean | null; cor_rm?: boolean | null }[]
    };

    if (!Array.isArray(body.updates) || body.updates.length === 0)
      return NextResponse.json({ error: "updates array required" }, { status: 400 });

    const ALLOWED = new Set(["cor_dir", "cor_lock", "cor_target", "cor_entry", "cor_rm", "is_bad"]);

    const results = await Promise.all(
      body.updates.map(async ({ trade_id, ...fields }) => {
        if (!trade_id) return { trade_id, error: "missing trade_id" };
        const patch: Record<string, boolean | null> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (ALLOWED.has(k)) patch[k] = v === null || v === undefined ? null : Boolean(v);
        }
        if (Object.keys(patch).length === 0) return { trade_id, skipped: true };
        const { error } = await supabase.from("trades").update(patch).eq("trade_id", trade_id);
        return { trade_id, error: error?.message ?? null };
      })
    );

    const failed = results.filter(r => "error" in r && r.error);
    if (failed.length > 0)
      return NextResponse.json({ error: "Some updates failed", details: failed }, { status: 500 });

    return NextResponse.json({ ok: true, updated: results.length });
  } catch (e) {
    console.error("[live-trades PATCH] unexpected", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/* Monday 00:00 AEST of (weeks) weeks ago, as UTC ISO string */
function weeksAgoUTC(weeks: number): string {
  const DAY_MS  = 24 * 60 * 60 * 1000;
  const AEST_MS = 10 * 60 * 60 * 1000;
  const aestNow = Date.now() + AEST_MS;
  const dow      = new Date(aestNow).getUTCDay();          // 0=Sun…6=Sat in AEST
  const backDays = dow === 0 ? 6 : dow - 1;               // days since last Monday
  const thisMondayAEST = aestNow - (aestNow % DAY_MS) - backDays * DAY_MS;
  const startAEST      = thisMondayAEST - (weeks - 1) * 7 * DAY_MS;
  return new Date(startAEST - AEST_MS).toISOString();
}

/* GET — trades within the last N weeks, ordered by entry desc */
export async function GET(req: Request) {
  try {
    const session = await auth() as Session | null;
    const s = session as AuthedSession | null;
    if (!s?.twoFactorVerified)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url   = new URL(req.url);
    const weeks = Math.max(1, Math.min(52, parseInt(url.searchParams.get("weeks") ?? "1", 10) || 1));
    const since = weeksAgoUTC(weeks);

    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .gte("entry", since)
      .order("entry", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[live-trades GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    console.error("[live-trades GET] unexpected", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
