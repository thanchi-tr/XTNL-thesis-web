import { NextResponse }               from "next/server";
import { auth }                       from "@/auth";
import { supabase, OPERATOR_USER_ID } from "@/lib/supabase";
import type { Session }               from "next-auth";

type AuthedSession = Session & { twoFactorVerified?: boolean };

function getAuthedSession(session: Session | null): AuthedSession | null {
  const s = session as AuthedSession | null;
  return s?.twoFactorVerified ? s : null;
}

const CAPITAL_ROLES = ["strategist", "fund_manager"];

/* Mirrors DEFAULT_PLANNED_INJECTED_FUND in
   src/action/action_generator/memory_generator.py — the baseline used
   before a strategist has ever set an explicit default here. */
const FALLBACK_DEFAULT_FUND = 2000.0;

const DEPLOY_STREAK_THRESHOLD = 4;

/* Re-derives the same scaling factor the pipeline computes in
   MemoryGenerator.generate() / HumanReportGenerator._get_sf() — a fixed
   1.20x compounding rate, damped by 0.025 per streak week once the streak
   passes 4 (volatility shield), floored at 0. Display-only here; the
   authoritative calculation still lives in the Python pipeline. */
function scalingFactor(streak: number): number {
  let sf = 1.20;
  if (streak > 4) sf -= 0.025 * streak;
  return Math.max(0, sf);
}

type LedgerRow = {
  week_id:            number;
  streak:             number;
  cumulate_fund:      number;
  deploy_fund:         boolean;
  accrued_commission: number;
  computed_at:        string;
};

async function latestLedgerRow(): Promise<LedgerRow | null> {
  const { data, error } = await supabase
    .from("system_memory_ledger")
    .select("week_id, streak, cumulate_fund, deploy_fund, accrued_commission, computed_at")
    .order("week_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function latestDefaultFund(): Promise<number> {
  const { data, error } = await supabase
    .from("capital_injection_config")
    .select("default_fund")
    .order("set_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? Number(data.default_fund) : FALLBACK_DEFAULT_FUND;
}

/* GET — Capital Injection panel state: current streak/fund from
   system_memory_ledger (owned by the Python pipeline, read-only here) plus
   the strategist-configured default fund. Gated to strategist/fund_manager
   — same privilege the panel itself is hidden behind client-side. */
export async function GET() {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = authed.roles ?? [];
    if (!roles.some(r => CAPITAL_ROLES.includes(r)))
      return NextResponse.json({ error: "Forbidden — strategist role required" }, { status: 403 });

    const [ledger, defaultFund] = await Promise.all([latestLedgerRow(), latestDefaultFund()]);
    const streak = ledger?.streak ?? 0;

    return NextResponse.json({
      weekId:         ledger?.week_id ?? null,
      streak,
      cumulateFund:   ledger?.cumulate_fund ?? defaultFund,
      deployFund:     ledger?.deploy_fund ?? false,
      defaultFund,
      scalingFactor:  scalingFactor(streak),
      deployable:     streak >= DEPLOY_STREAK_THRESHOLD,
      threshold:      DEPLOY_STREAK_THRESHOLD,
    });
  } catch (e) {
    console.error("[capital-injection GET] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/* PUT — strategist sets the default fund that a future deploy resets
   cumulate_fund to. Append-only insert, same pattern as session_schedule. */
export async function PUT(req: Request) {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = authed.roles ?? [];
    if (!roles.some(r => CAPITAL_ROLES.includes(r)))
      return NextResponse.json({ error: "Forbidden — strategist role required" }, { status: 403 });

    const body = await req.json().catch(() => null) as { defaultFund?: unknown } | null;
    const defaultFund = Number(body?.defaultFund);
    if (!Number.isFinite(defaultFund) || defaultFund <= 0)
      return NextResponse.json({ error: "defaultFund must be a positive number" }, { status: 400 });

    const { error } = await supabase.from("capital_injection_config").insert({
      default_fund: defaultFund,
      set_by:       authed.userEmail,
    });
    if (error) {
      console.error("[capital-injection PUT] insert error", error);
      return NextResponse.json({ error: "Failed to save default fund." }, { status: 500 });
    }

    const now = new Date().toISOString();
    const commentRow: Record<string, unknown> = {
      content:    `[Capital Injection] ${authed.userEmail} set the default fund to $${defaultFund.toLocaleString()}`,
      created_at: now,
      Entry:      now,
    };
    if (OPERATOR_USER_ID) commentRow.user_id = OPERATOR_USER_ID;
    await supabase.from("comments").insert(commentRow);

    return NextResponse.json({ ok: true, defaultFund });
  } catch (e) {
    console.error("[capital-injection PUT] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/* POST — deploy capital: only when the current streak has hit the
   threshold. Resets streak to 0 and cumulate_fund back to the
   strategist-configured default directly on the current
   system_memory_ledger row (the same reset the Python pipeline performs
   when it observes deploy_fund=true on its next run — done here
   immediately so the Governance page reflects it right away). */
export async function POST() {
  try {
    const session = await auth() as Session | null;
    const authed  = getAuthedSession(session);
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = authed.roles ?? [];
    if (!roles.some(r => CAPITAL_ROLES.includes(r)))
      return NextResponse.json({ error: "Forbidden — strategist role required" }, { status: 403 });

    const ledger = await latestLedgerRow();
    if (!ledger)
      return NextResponse.json({ error: "No system_memory_ledger row found yet." }, { status: 404 });

    if (ledger.streak < DEPLOY_STREAK_THRESHOLD)
      return NextResponse.json(
        { error: `Streak (${ledger.streak}) is below the deployable threshold (${DEPLOY_STREAK_THRESHOLD}).` },
        { status: 400 },
      );

    const defaultFund = await latestDefaultFund();
    const prevStreak   = ledger.streak;
    const prevFund     = ledger.cumulate_fund;

    const { data: updated, error } = await supabase
      .from("system_memory_ledger")
      .update({ streak: 0, cumulate_fund: defaultFund, deploy_fund: false })
      .eq("week_id", ledger.week_id)
      .select("week_id, streak, cumulate_fund, deploy_fund")
      .single();

    if (error) {
      console.error("[capital-injection POST] update error", error);
      return NextResponse.json({ error: "Failed to deploy capital." }, { status: 500 });
    }

    const now = new Date().toISOString();
    const commentRow: Record<string, unknown> = {
      content: `[Capital Injection] ${authed.userEmail} deployed capital — ` +
        `streak reset ${prevStreak}→0, fund reset $${prevFund.toLocaleString()}→$${defaultFund.toLocaleString()} ` +
        `(week_id ${ledger.week_id})`,
      created_at: now,
      Entry:      now,
    };
    if (OPERATOR_USER_ID) commentRow.user_id = OPERATOR_USER_ID;
    await supabase.from("comments").insert(commentRow);

    return NextResponse.json({
      ok:           true,
      weekId:       updated.week_id,
      streak:       updated.streak,
      cumulateFund: updated.cumulate_fund,
      deployFund:   updated.deploy_fund,
      scalingFactor: scalingFactor(updated.streak),
      deployable:    updated.streak >= DEPLOY_STREAK_THRESHOLD,
    });
  } catch (e) {
    console.error("[capital-injection POST] unexpected", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
