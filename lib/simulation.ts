/* ═══════════════════════════════════════════════════════════════════
   XTNL Monte Carlo Simulation Engine — v5
   ───────────────────────────────────────────────────────────────────
   COMPOUNDING MODEL
   -----------------
   Risk is sized as a FIXED % of week-start equity — computed once,
   applied uniformly across all trades in that week.

   Per-week sequence:
     1. OU step → this week's operator efficiency
     2. appliedRisk = base_r × perf_mult × regime_penalty × 0.95
        (computed from week-start streak — FIXED for the whole week)
     3. Simulate tradesPerWeek individual trades:
          a. Draw tradeR ~ N(μ_decay, σ)
          b. Sum into weeklyTotalR
          c. Update losing streak per-trade  ← affects NEXT week's risk
     4. Apply weekly slippage once on positive result
     5. capturedWeeklyR = weeklyTotalR × eff  (efficiency scales yield)
     6. equity_end = equity_start × (1 + appliedRisk × capturedWeeklyR)
        ← position size was equity_start × appliedRisk, fixed all week

   Compounding is BETWEEN weeks: equity_start next week = equity_end
   this week, so position size grows/shrinks with each completed week.
   Within a week the position size does not change.

   Risk formula (recommend_r_generator.py):
     final_risk = base_r × perf_mult(eff) × regime_penalty(streak) × 0.95

   Commission (current_commission_generator.py):
     comm = (base_r × 0.20 + max(totalRealised, 0) × 0.05) × [1.5 if eff ≥ 0.95]
     Gate: eff ≥ 0.88

   Injection (memory_generator.py — 4-week gate):
     Every 4 weeks: ALL 4 weeks eff > 0.85 → inject frozenPool
     Excellence (any eff > 0.95) → pool × scalingFactor (1.20 − 0.025×streak)
     Failure → pool resets to baseline, injStreak = 0
   ═══════════════════════════════════════════════════════════════════ */

export interface SimParams {
  /* ── Edge ─────────────────────────────────────────────────────── */
  baseRiskPct:         number;  // CVaR-derived base risk % per 1R trade (e.g. 0.70)
  expPerTrade:         number;  // R-multiple expectancy per trade (μ)
  tradesPerWeek:       number;  // validated entries per operational week
  volPerTrade:         number;  // per-trade R standard deviation (σ)
  edgeDecayPctPerQtr:  number;  // expectancy erosion % every 13 weeks

  /* ── Operator (OU process) ────────────────────────────────────── */
  operatorMeanEff:     number;  // OU long-run mean efficiency μ_eff ∈ [0.60, 0.98]
  //   eff[t+1] = eff[t] + 0.35·(μ − eff[t]) + 0.075·Z  (θ=0.35, σ=0.075)

  /* ── Commission distribution ─────────────────────────────────── */
  commissionStartWeek: number;  // weeks before commission payments begin (0 = immediate)

  /* ── Capital injection (4-week gate) ─────────────────────────── */
  frozenPoolPct:       number;  // base pool per qualifying 4-wk period (fraction of initial)
  //   Qualification: ALL 4 weeks eff > 0.85
  //   Excellence:    any eff > 0.95 → pool × max(1.0, 1.20 − 0.025×streak)
  //   Failure:       pool resets to frozenPoolPct, injStreak = 0

  /* ── Risk controls ────────────────────────────────────────────── */
  taxRatePct:          number;  // ATO annual statutory drag (max 47%)
  maxDDLimit:          number;  // halt path if peak-to-trough DD% ≥ this (0 = off)
  weeks:               number;  // simulation horizon
}

/* ── Output types ─────────────────────────────────────────────── */
export interface PathResult {
  equity:      number[];
  effPath:     number[];    // OU efficiency recorded each week
  regimePath:  number[];    // regime penalty applied each week
  terminal:    number;
  maxDD:       number;
  meanEff:     number;
  totalComm:   number;      // cumulative commission (fraction of initial equity)
  totalInj:    number;      // cumulative injections (fraction of initial equity)
  injEvents:   number;
  halted:      boolean;
  haltWeek:    number | null;
}

export interface EffStats {
  pctExcellence: number;
  pctNormal:     number;
  pctReduced:    number;
  pctCritical:   number;
  pctHalted:     number;
}

export interface RegimeStats {
  pctHealthy:  number;
  pctMonitor:  number;
  pctHaircut:  number;
  pctToxic:    number;
}

export interface SimSummary {
  meanTerminal:       number;
  medianTerminal:     number;
  p5Terminal:         number;
  p95Terminal:        number;
  worstTerminal:      number;
  meanMaxDD:          number;
  worstMaxDD:         number;
  pctRuined:          number;
  paths:              number[][];
  effPathSamples:     number[][];
  regPathSamples:     number[][];
  injectionCutoff:    number;
  effStats:           EffStats;
  regimeStats:        RegimeStats;
  meanMeanEff:        number;
  meanRegimePenalty:  number;
  meanTotalComm:      number;
  meanAvgCommPerWeek: number;
  meanTotalInj:       number;
  meanInjEvents:      number;
}

/* ─────────────────────────────────────────────────────────────────
   Math helpers
   ───────────────────────────────────────────────────────────────── */
function randnBm(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** OU step for operator efficiency */
function ouStep(current: number, mean: number): number {
  const next = current + 0.35 * (mean - current) + 0.075 * randnBm();
  return Math.max(0.40, Math.min(1.0, next));
}

/**
 * Performance-gated risk multiplier (recommend_r_generator.py):
 *   eff < 0.40 → 0.00   eff < 0.50 → 0.30   eff < 0.80 → 0.60
 *   eff ≥ 0.95 → 1.18   else       → 1.00
 */
function perfMult(eff: number): number {
  if (eff < 0.40) return 0.00;
  if (eff < 0.50) return 0.30;
  if (eff < 0.80) return 0.60;
  if (eff >= 0.95) return 1.18;
  return 1.00;
}

/**
 * Regime penalty from losing-streak ratio (MC95 sentinel):
 *   ratio < 0.60         → 1.00 (healthy)
 *   0.60 ≤ ratio < 0.80  → 1.00 (monitored — no cut yet)
 *   0.80 ≤ ratio < 1.00  → max(0.60, 1.0 − (ratio − 0.80) × 3.5)
 *   ratio ≥ 1.00         → 0.50 (TOXIC REGIME HALT)
 */
function regimePenalty(streakRatio: number): number {
  if (streakRatio >= 1.00) return 0.50;
  if (streakRatio >= 0.80) return Math.max(0.60, 1.0 - (streakRatio - 0.80) * 3.5);
  return 1.00;
}

const MC95_MAX_STREAK = 12; // trade-level threshold from SESSION_FILTERED live data

/* ─────────────────────────────────────────────────────────────────
   Single path — weekly compounding, trade-level streak tracking
   ───────────────────────────────────────────────────────────────── */
export function runPath(p: SimParams): PathResult {
  const baseRisk  = p.baseRiskPct / 100;
  const taxRate   = p.taxRatePct  / 100;
  const edgeDecay = 1 - p.edgeDecayPctPerQtr / 100;

  let equity         = 1.0;   // multiples of initial capital
  let maxPeak        = 1.0;
  let maxDD          = 0.0;
  let capAtYearStart = 1.0;
  let halted         = false;
  let haltWeek: number | null = null;

  /* Operator efficiency — start near mean with small noise */
  let eff = Math.max(0.40, Math.min(1.0, p.operatorMeanEff + 0.06 * randnBm()));

  /* Streak: individual-trade level, persists across weeks */
  let losingStreak  = 0;

  /* Injection state */
  const eff4Wk:  number[] = [];
  let frozenPool = p.frozenPoolPct;
  let injStreak  = 0;
  let totalInj   = 0;
  let injEvents  = 0;

  let totalComm  = 0;

  const equitySeries: number[] = [];
  const effSeries:    number[] = [];
  const regSeries:    number[] = [];
  let   effSum    = 0;
  let   regSum    = 0;

  for (let w = 1; w <= p.weeks; w++) {

    /* ── 1. Operator efficiency (OU step) ──────────────────────── */
    eff     = ouStep(eff, p.operatorMeanEff);
    effSum += eff;

    /* ── 2. Compute weekly risk ONCE from week-start streak ─────── *
     *   Mirrors how Recommend_R is a weekly signal in the real sys. */
    const streakRatioAtWeekStart = losingStreak / MC95_MAX_STREAK;
    const weekRegPen   = regimePenalty(streakRatioAtWeekStart);
    const weekEffMult  = perfMult(eff);
    /* final_risk = base_r × perf_mult × regime_penalty × 0.95      */
    const appliedRisk  = baseRisk * weekEffMult * weekRegPen * 0.95;

    regSum += weekRegPen;
    regSeries.push(weekRegPen);

    /* ── 3. Simulate individual trades within the week ───────────── *
     *   Position size = equity_at_week_start × appliedRisk          *
     *   This is FIXED for all trades this week.                      *
     *   Equity only updates once, at the end of the week.            */
    const decayFactor = Math.pow(edgeDecay, Math.floor((w - 1) / 13));
    const muTrade     = p.expPerTrade * decayFactor;

    let weeklyTotalR  = 0;   // sum of raw R-multiples across all trades

    for (let t = 0; t < p.tradesPerWeek; t++) {
      const tradeR = muTrade + p.volPerTrade * randnBm();
      weeklyTotalR += tradeR;

      /* Streak updates per-trade, but does NOT change appliedRisk    *
       * until the START of the next week.                             */
      if (tradeR < 0) losingStreak++;
      else            losingStreak = 0;
    }

    /* ── 4. Weekly slippage (once, on positive weeks) ─────────────── */
    if (weeklyTotalR > 0) weeklyTotalR -= (0.1 + Math.random() * 0.1);

    /* ── 5. Operator efficiency scales total captured R ──────────── */
    const capturedWeeklyR = weeklyTotalR * eff;

    /* ── 6. Single weekly equity update (compounding between weeks) ─ *
     *   P&L this week = equity_start × appliedRisk × capturedWeeklyR *
     *   equity_end    = equity_start × (1 + appliedRisk × capturedR) *
     *                                                                  *
     *   Next week: appliedRisk recomputed from updated equity,        *
     *   so the dollar position size grows/shrinks with equity — this  *
     *   is where the weekly compounding occurs.                        */
    if (!halted) {
      equity *= (1 + appliedRisk * capturedWeeklyR);
      if (equity < 0) equity = 0;
    }

    const weeklyRealised = capturedWeeklyR;  // alias for commission calc below

    /* ── 7. Commission deduction ─────────────────────────────────── *
     *   Mirrors current_commission_generator.py:                     *
     *     base  = recommend_r × 0.20                                 *
     *     bonus = max(realised_r, 0) × 0.05                          *
     *     mult  = 1.5× when eff ≥ 0.95                               *
     *   Gate: eff ≥ 0.88                                             */
    if (!halted && w >= p.commissionStartWeek && eff >= 0.88) {
      const commMult  = eff >= 0.95 ? 1.5 : 1.0;
      const baseComm  = appliedRisk * 0.20;
      const bonusComm = Math.max(weeklyRealised * appliedRisk, 0) * 0.05;
      const commFrac  = (baseComm + bonusComm) * commMult;
      equity         *= (1 - commFrac);   // paid out — reduces compounding base
      totalComm      += commFrac;
    }

    /* ── 8. 4-week capital injection gate ───────────────────────── *
     *   Every 4 weeks: ALL 4 weeks must have eff > 0.85             *
     *   Excellence (any eff > 0.95): pool × scalingFactor           *
     *   Failure: pool resets, injStreak = 0                         */
    eff4Wk.push(eff);
    if (eff4Wk.length > 4) eff4Wk.shift();

    if (w % 4 === 0 && p.frozenPoolPct > 0) {
      const allQualify   = eff4Wk.length === 4 && eff4Wk.every((e) => e > 0.85);
      const anyExcellent = eff4Wk.some((e) => e > 0.95);

      if (allQualify) {
        if (anyExcellent) {
          injStreak++;
          /* Volatility shield: scaling decays as consecutive streak grows */
          const sf = Math.max(1.0, 1.20 - 0.025 * injStreak);
          frozenPool = Math.max(p.frozenPoolPct, frozenPool * sf);
        } else {
          injStreak++;
        }
        if (!halted) {
          equity   += frozenPool;   // inject into compounding base
          maxPeak   = Math.max(maxPeak, equity);
          totalInj += frozenPool;
          injEvents++;
        }
      } else {
        injStreak  = 0;
        frozenPool = p.frozenPoolPct;
      }
    }

    /* ── 6. Annual ATO tax (year-end) ────────────────────────────── */
    if (w % 52 === 0 && !halted && equity > capAtYearStart) {
      const taxable = equity - capAtYearStart;
      equity       -= taxable * taxRate;
      maxPeak       = Math.max(0, maxPeak - taxable * taxRate);
      capAtYearStart = equity;
    }

    /* ── 7. Drawdown tracking ─────────────────────────────────────── */
    if (equity > maxPeak) maxPeak = equity;
    const dd = maxPeak > 0 ? (maxPeak - equity) / maxPeak : 0;
    if (dd > maxDD) maxDD = dd;

    if (!halted && p.maxDDLimit > 0 && dd * 100 >= p.maxDDLimit) {
      halted   = true;
      haltWeek = w;
    }

    equitySeries.push(equity);
    effSeries.push(eff);
  }

  return {
    equity:     equitySeries,
    effPath:    effSeries,
    regimePath: regSeries,
    terminal:   equity,
    maxDD,
    meanEff:    effSum / p.weeks,
    totalComm,
    totalInj,
    injEvents,
    halted,
    haltWeek,
  };
}

/* ─────────────────────────────────────────────────────────────────
   Full simulation — 1,000 paths
   ───────────────────────────────────────────────────────────────── */
export function runSimulation(p: SimParams, iterations = 1000): SimSummary {
  const results: PathResult[] = [];
  for (let i = 0; i < iterations; i++) results.push(runPath(p));

  const terminals  = results.map((r) => r.terminal).sort((a, b) => a - b);
  const drawdowns  = results.map((r) => r.maxDD);
  const meanEffs   = results.map((r) => r.meanEff);

  const n          = iterations;
  const mean       = terminals.reduce((a, b) => a + b, 0) / n;
  const median     = terminals[Math.floor(n / 2)];
  const p5         = terminals[Math.floor(n * 0.05)];
  const p95        = terminals[Math.floor(n * 0.95)];
  const meanMaxDD  = drawdowns.reduce((a, b) => a + b, 0) / n;
  const worstMaxDD = Math.max(...drawdowns);
  const ruined     = results.filter((r) => r.terminal < 0.10).length;
  const meanMeanEff      = meanEffs.reduce((a, b) => a + b, 0) / n;
  const meanTotalComm    = results.reduce((a, r) => a + r.totalComm, 0) / n;
  const meanAvgCommPerWeek = meanTotalComm / p.weeks;
  const meanTotalInj     = results.reduce((a, r) => a + r.totalInj, 0) / n;
  const meanInjEvents    = results.reduce((a, r) => a + r.injEvents, 0) / n;

  /* Efficiency tier stats */
  let tot = 0, exc = 0, nor = 0, red = 0, crit = 0, hlt = 0;
  results.forEach((r) => r.effPath.forEach((e) => {
    tot++;
    if (e >= 0.95) exc++; else if (e >= 0.80) nor++;
    else if (e >= 0.50) red++; else if (e >= 0.40) crit++; else hlt++;
  }));
  const effStats: EffStats = {
    pctExcellence: exc  / tot * 100,
    pctNormal:     nor  / tot * 100,
    pctReduced:    red  / tot * 100,
    pctCritical:   crit / tot * 100,
    pctHalted:     hlt  / tot * 100,
  };

  /* Regime penalty stats */
  let rTot = 0, rHealthy = 0, rMon = 0, rHair = 0, rTox = 0, regSum = 0;
  results.forEach((r) => r.regimePath.forEach((pen) => {
    rTot++; regSum += pen;
    if (pen >= 1.00) rHealthy++; else if (pen > 0.55) rHair++; else rTox++;
  }));
  const regimeStats: RegimeStats = {
    pctHealthy:  rHealthy / rTot * 100,
    pctMonitor:  rMon     / rTot * 100,
    pctHaircut:  rHair    / rTot * 100,
    pctToxic:    rTox     / rTot * 100,
  };

  /* Sample paths for chart rendering */
  const step           = Math.max(1, Math.floor(n / 200));
  const paths          = results.filter((_, i) => i % step === 0).slice(0, 200).map((r) => r.equity);
  const sortedByEff    = [...results].sort((a, b) => a.meanEff - b.meanEff);
  const effPathSamples = [0, 0.1, 0.25, 0.5, 0.75, 0.9].map((pct) =>
    sortedByEff[Math.min(Math.floor(pct * n), n - 1)].effPath
  );
  const regPathSamples = [0, 0.1, 0.25, 0.5, 0.75, 0.9].map((pct) =>
    sortedByEff[Math.min(Math.floor(pct * n), n - 1)].regimePath
  );

  return {
    meanTerminal: mean, medianTerminal: median,
    p5Terminal: p5, p95Terminal: p95,
    worstTerminal: terminals[0],
    meanMaxDD, worstMaxDD,
    pctRuined: ruined / n * 100,
    paths, effPathSamples, regPathSamples,
    injectionCutoff: 0,
    effStats, regimeStats,
    meanMeanEff, meanRegimePenalty: regSum / rTot,
    meanTotalComm, meanAvgCommPerWeek, meanTotalInj, meanInjEvents,
  };
}

export function formatMultiple(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(2);
}
