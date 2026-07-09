"use client";

import React, {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
} from "react";
import { startTransition } from "react";
import { runSimulation } from "@/lib/simulation";
import type { SimParams, SimSummary } from "@/lib/simulation";

/* ── Default parameters (from live system data) ─────────────── */
export const DEFAULT_PARAMS: SimParams = {
  baseRiskPct:         0.70,   // Recommend R = 0.007 (SESSION_FILTERED)
  expPerTrade:         0.982,  // SESSION_FILTERED μ
  tradesPerWeek:       8,      // live avg trades/week
  volPerTrade:         2.4,
  edgeDecayPctPerQtr:  3,
  operatorMeanEff:     0.82,   // live inferred efficiency rating
  commissionStartWeek: 52,     // distribute after 1 year of operation
  frozenPoolPct:       0,      // off by default
  taxRatePct:          47,     // ATO max marginal + 2% Medicare
  maxDDLimit:          0,      // off
  weeks:               260,    // 5 years
  /* Governor — Incentive structure */
  fixedRatePct:        0,      // off by default
  bonusRatePct:        0,      // off by default
  bonusThreshold:      0.80,   // 80% actual capture rate triggers bonus
  /* Governor — Scaling conditions */
  scalingConditions:   [],     // no rules — engine behaves identically to v5
  /* Operator attributed randomness */
  efficiencyStdDev:    0,      // no extra noise beyond OU
  captureRateMean:     1.0,    // 100% capture — identical to v5 behaviour
  captureRateStdDev:   0,      // deterministic capture rate
  tradeFreqStdDev:     0,      // fixed trade count
};

/* ── Context shape ───────────────────────────────────────────── */
interface SimulatorCtx {
  params:    SimParams;
  result:    SimSummary | null;
  running:   boolean;
  setParam:  <K extends keyof SimParams>(key: K, val: SimParams[K]) => void;
  setParams: (p: SimParams) => void;
  rerun:     () => void;
}

const SimulatorContext = createContext<SimulatorCtx | null>(null);

/* ── Provider ────────────────────────────────────────────────── */
export function SimulatorProvider({ children }: { children: React.ReactNode }) {
  const [params,  setParamsState] = useState<SimParams>(DEFAULT_PARAMS);
  const [result,  setResult]      = useState<SimSummary | null>(null);
  const [running, setRunning]     = useState(false);

  const debRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paramsRef = useRef<SimParams>(DEFAULT_PARAMS);
  const reqId     = useRef(0);

  /* Run simulation on the main thread via setTimeout so the
     "Running…" state renders before the synchronous compute starts */
  const dispatch = useCallback((p: SimParams) => {
    if (debRef.current) clearTimeout(debRef.current);
    const id = ++reqId.current;
    setRunning(true);
    setTimeout(() => {
      const res = runSimulation(p, 1000);
      if (id !== reqId.current) return; // superseded
      startTransition(() => {
        setResult(res);
        setRunning(false);
      });
    }, 0);
  }, []);

  /* Auto-run on mount */
  useEffect(() => {
    dispatch(DEFAULT_PARAMS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Single-param change — debounced 300 ms */
  const setParam = useCallback(<K extends keyof SimParams>(key: K, val: SimParams[K]) => {
    const next = { ...paramsRef.current, [key]: val };
    paramsRef.current = next;
    setParamsState(next);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => dispatch(next), 300);
  }, [dispatch]);

  /* Full preset swap — immediate */
  const setParams = useCallback((p: SimParams) => {
    paramsRef.current = p;
    setParamsState(p);
    dispatch(p);
  }, [dispatch]);

  /* Manual re-run */
  const rerun = useCallback(() => {
    dispatch(paramsRef.current);
  }, [dispatch]);

  return (
    <SimulatorContext.Provider value={{ params, result, running, setParam, setParams, rerun }}>
      {children}
    </SimulatorContext.Provider>
  );
}

/* ── Hook ────────────────────────────────────────────────────── */
export function useSimulator(): SimulatorCtx {
  const ctx = useContext(SimulatorContext);
  if (!ctx) throw new Error("useSimulator must be used within <SimulatorProvider>");
  return ctx;
}
