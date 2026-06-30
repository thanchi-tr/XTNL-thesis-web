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

// Marsaglia-Bray polar method: produces 2 normals per iteration (no Math.cos),
// caches the second.  ~40 % faster than Box-Muller for bulk generation.
let _spare: number | null = null;
function randn(): number {
  if (_spare !== null) { const z = _spare; _spare = null; return z; }
  let u: number, v: number, s: number;
  do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v; }
  while (s >= 1 || s === 0);
  const f = Math.sqrt(-2 * Math.log(s) / s);
  _spare = v * f;
  return u * f;
}

/** OU step for operator efficiency */
function ouStep(current: number, mean: number): number {
  const next = current + 0.35 * (mean - current) + 0.075 * randn();
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
  let eff = Math.max(0.40, Math.min(1.0, p.operatorMeanEff + 0.06 * randn()));

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
      const tradeR = muTrade + p.volPerTrade * randn();
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
   Full simulation — optimised for speed
   Key changes over the naïve version:
   • Decay factors pre-computed once (not per-week-per-path)
   • Only 200 sampled paths write equity/eff/reg arrays; the other
     800 paths update scalar accumulators only — zero GC pressure
   • Eff / regime tier counts accumulated inline — no post passes
   • Float64Array used throughout for cache-friendly numeric storage
   ───────────────────────────────────────────────────────────────── */
export function runSimulation(p: SimParams, iterations = 1000): SimSummary {
  const baseRisk  = p.baseRiskPct / 100;
  const taxRate   = p.taxRatePct  / 100;
  const edgeDecay = 1 - p.edgeDecayPctPerQtr / 100;
  const { weeks, tradesPerWeek, expPerTrade, volPerTrade,
          operatorMeanEff, frozenPoolPct,
          commissionStartWeek, maxDDLimit } = p;

  /* Pre-compute quarterly decay factor per week — eliminates Math.pow from hot loop */
  const decayFactors = new Float64Array(weeks);
  for (let w = 0; w < weeks; w++) decayFactors[w] = Math.pow(edgeDecay, Math.floor(w / 13));

  /* Chart storage: every STEP-th path, up to 200 */
  const STEP   = Math.max(1, Math.floor(iterations / 200));
  const NCHART = Math.min(200, Math.ceil(iterations / STEP));
  const chartEq  = Array.from({ length: NCHART }, () => new Float64Array(weeks));
  const chartEff = Array.from({ length: NCHART }, () => new Float64Array(weeks));
  const chartReg = Array.from({ length: NCHART }, () => new Float64Array(weeks));
  const chartMeanEff = new Float64Array(NCHART);

  /* Per-path scalars (no per-path series arrays) */
  const terminals = new Float64Array(iterations);
  const maxDDs    = new Float64Array(iterations);
  const meanEffs  = new Float64Array(iterations);
  const commSums  = new Float64Array(iterations);
  const injSums   = new Float64Array(iterations);
  const injEvts   = new Uint16Array(iterations);

  /* Inline stat counters — no post-processing passes needed */
  let excCt = 0, norCt = 0, redCt = 0, critCt = 0, hltCt = 0;
  let rHealthy = 0, rHair = 0, rTox = 0, globalRegSum = 0;
  let ruined = 0;

  /* Reusable buffers for sampled-path recording */
  const tmpEq  = new Float64Array(weeks);
  const tmpEff = new Float64Array(weeks);
  const tmpReg = new Float64Array(weeks);

  /* 4-slot circular buffer for the injection gate */
  const eff4 = new Float64Array(4);

  for (let i = 0; i < iterations; i++) {
    const isSampled = i % STEP === 0;
    const chartIdx  = isSampled ? Math.floor(i / STEP) : -1;

    /* ── Path init ─────────────────────────────────────────────── */
    let equity      = 1.0;
    let maxPeak     = 1.0;
    let maxDD_p     = 0.0;
    let capAtYear   = 1.0;
    let halted      = false;

    let eff = Math.max(0.40, Math.min(1.0, operatorMeanEff + 0.06 * randn()));
    let losingStreak = 0;

    let frozenPool  = frozenPoolPct;
    let injStreak   = 0;
    let inj4Count   = 0;
    let totalInj_p  = 0;
    let injEvts_p   = 0;
    let totalComm_p = 0;
    let effSum_p    = 0;

    /* ── Weekly loop ───────────────────────────────────────────── */
    for (let w = 0; w < weeks; w++) {

      /* 1. OU step (inlined for speed) */
      {
        const nx = eff + 0.35 * (operatorMeanEff - eff) + 0.075 * randn();
        eff = nx < 0.40 ? 0.40 : nx > 1.0 ? 1.0 : nx;
      }
      effSum_p += eff;

      /* 2. Weekly risk (perfMult + regimePenalty inlined) */
      const streakRatio = losingStreak / MC95_MAX_STREAK;
      const weekRegPen  = streakRatio >= 1.0 ? 0.5
                        : streakRatio >= 0.8  ? Math.max(0.6, 1.0 - (streakRatio - 0.8) * 3.5)
                        : 1.0;
      const weekEffMult = eff >= 0.95 ? 1.18
                        : eff >= 0.80 ? 1.00
                        : eff >= 0.50 ? 0.60
                        : eff >= 0.40 ? 0.30 : 0.00;
      const appliedRisk = baseRisk * weekEffMult * weekRegPen * 0.95;

      /* 3. Simulate trades */
      const muTrade = expPerTrade * decayFactors[w];
      let weeklyTotalR = 0;
      for (let t = 0; t < tradesPerWeek; t++) {
        const tradeR = muTrade + volPerTrade * randn();
        weeklyTotalR += tradeR;
        if (tradeR < 0) losingStreak++; else losingStreak = 0;
      }

      /* 4. Slippage */
      if (weeklyTotalR > 0) weeklyTotalR -= (0.1 + Math.random() * 0.1);

      /* 5. Captured R */
      const capturedR = weeklyTotalR * eff;

      /* 6. Equity update */
      if (!halted) {
        equity *= (1 + appliedRisk * capturedR);
        if (equity < 0) equity = 0;
      }

      /* 7. Commission */
      if (!halted && w + 1 >= commissionStartWeek && eff >= 0.88) {
        const commMult  = eff >= 0.95 ? 1.5 : 1.0;
        const commFrac  = (appliedRisk * 0.20 + Math.max(capturedR * appliedRisk, 0) * 0.05) * commMult;
        equity         *= (1 - commFrac);
        totalComm_p    += commFrac;
      }

      /* 8. 4-week injection gate (circular buffer, no push/shift) */
      eff4[w & 3] = eff;
      if (inj4Count < 4) inj4Count++;

      if ((w + 1) % 4 === 0 && frozenPoolPct > 0) {
        let allQ = inj4Count === 4, anyExc = false;
        if (allQ) {
          for (let k = 0; k < 4; k++) {
            if (eff4[k] <= 0.85) { allQ = false; break; }
            if (eff4[k] > 0.95) anyExc = true;
          }
        }
        if (allQ) {
          if (anyExc) {
            injStreak++;
            frozenPool = Math.max(frozenPoolPct, frozenPool * Math.max(1.0, 1.20 - 0.025 * injStreak));
          } else {
            injStreak++;
          }
          if (!halted) {
            equity += frozenPool;
            if (equity > maxPeak) maxPeak = equity;
            totalInj_p += frozenPool;
            injEvts_p++;
          }
        } else {
          injStreak = 0; frozenPool = frozenPoolPct;
        }
      }

      /* 9. Annual tax */
      if ((w + 1) % 52 === 0 && !halted && equity > capAtYear) {
        const taxable = equity - capAtYear;
        equity       -= taxable * taxRate;
        maxPeak       = Math.max(0, maxPeak - taxable * taxRate);
        capAtYear     = equity;
      }

      /* 10. Drawdown + halt */
      if (equity > maxPeak) maxPeak = equity;
      const dd = maxPeak > 0 ? (maxPeak - equity) / maxPeak : 0;
      if (dd > maxDD_p) maxDD_p = dd;
      if (!halted && maxDDLimit > 0 && dd * 100 >= maxDDLimit) halted = true;

      /* 11. Tier counters accumulated inline — replaces two O(n×w) post passes */
      if      (eff >= 0.95) excCt++;
      else if (eff >= 0.80) norCt++;
      else if (eff >= 0.50) redCt++;
      else if (eff >= 0.40) critCt++;
      else                  hltCt++;

      if      (weekRegPen >= 1.0) rHealthy++;
      else if (weekRegPen > 0.55) rHair++;
      else                        rTox++;
      globalRegSum += weekRegPen;

      /* 12. Only write series for sampled paths (saves 80 % of array writes) */
      if (isSampled) {
        tmpEq[w]  = equity;
        tmpEff[w] = eff;
        tmpReg[w] = weekRegPen;
      }
    }

    /* ── Store path scalars ─────────────────────────────────── */
    terminals[i] = equity;
    maxDDs[i]    = maxDD_p;
    meanEffs[i]  = effSum_p / weeks;
    commSums[i]  = totalComm_p;
    injSums[i]   = totalInj_p;
    injEvts[i]   = injEvts_p;
    if (equity < 0.10) ruined++;

    if (isSampled && chartIdx < NCHART) {
      chartEq[chartIdx].set(tmpEq);
      chartEff[chartIdx].set(tmpEff);
      chartReg[chartIdx].set(tmpReg);
      chartMeanEff[chartIdx] = effSum_p / weeks;
    }
  }

  /* ── Aggregate ──────────────────────────────────────────────── */
  const n = iterations;
  const sortedTerminals = Float64Array.from(terminals).sort();

  let meanTerminal = 0, commTotal = 0, injTotal = 0, injEvtTotal = 0,
      ddTotal = 0, worstDD = 0, effMeanTotal = 0;
  for (let i = 0; i < n; i++) {
    meanTerminal  += terminals[i];
    commTotal     += commSums[i];
    injTotal      += injSums[i];
    injEvtTotal   += injEvts[i];
    ddTotal       += maxDDs[i];
    if (maxDDs[i] > worstDD) worstDD = maxDDs[i];
    effMeanTotal  += meanEffs[i];
  }
  meanTerminal /= n;

  const nw = n * weeks;
  const effStats: EffStats = {
    pctExcellence: excCt  / nw * 100,
    pctNormal:     norCt  / nw * 100,
    pctReduced:    redCt  / nw * 100,
    pctCritical:   critCt / nw * 100,
    pctHalted:     hltCt  / nw * 100,
  };
  const regimeStats: RegimeStats = {
    pctHealthy:  rHealthy / nw * 100,
    pctMonitor:  0,
    pctHaircut:  rHair    / nw * 100,
    pctToxic:    rTox     / nw * 100,
  };

  /* eff/reg path samples: sort the 200 chart paths by meanEff, pick 6 percentiles */
  const sortedChartIdx = Array.from({ length: NCHART }, (_, i) => i)
    .sort((a, b) => chartMeanEff[a] - chartMeanEff[b]);
  const EFF_PCTS = [0, 0.1, 0.25, 0.5, 0.75, 0.9];
  const effPathSamples = EFF_PCTS.map((pct) => {
    const idx = sortedChartIdx[Math.min(Math.floor(pct * NCHART), NCHART - 1)];
    return Array.from(chartEff[idx]);
  });
  const regPathSamples = EFF_PCTS.map((pct) => {
    const idx = sortedChartIdx[Math.min(Math.floor(pct * NCHART), NCHART - 1)];
    return Array.from(chartReg[idx]);
  });

  const paths = chartEq.map((buf) => Array.from(buf));
  const meanTotalComm = commTotal / n;

  return {
    meanTerminal,
    medianTerminal:    sortedTerminals[Math.floor(n / 2)],
    p5Terminal:        sortedTerminals[Math.floor(n * 0.05)],
    p95Terminal:       sortedTerminals[Math.floor(n * 0.95)],
    worstTerminal:     sortedTerminals[0],
    meanMaxDD:         ddTotal / n,
    worstMaxDD:        worstDD,
    pctRuined:         ruined / n * 100,
    paths, effPathSamples, regPathSamples,
    injectionCutoff:   0,
    effStats, regimeStats,
    meanMeanEff:           effMeanTotal / n,
    meanRegimePenalty:     globalRegSum / nw,
    meanTotalComm,
    meanAvgCommPerWeek:    meanTotalComm / weeks,
    meanTotalInj:          injTotal / n,
    meanInjEvents:         injEvtTotal / n,
  };
}

export function formatMultiple(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(2);
}
