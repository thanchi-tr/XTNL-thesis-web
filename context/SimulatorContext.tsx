"use client";

import React, {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
} from "react";
import { startTransition } from "react";
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

  // Refs: avoid stale closures without creating extra re-renders
  const workerRef = useRef<Worker | null>(null);
  const debRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paramsRef = useRef<SimParams>(DEFAULT_PARAMS); // always mirrors latest params
  const reqId     = useRef(0);                         // discards stale results

  /* Spawn worker once on mount, terminate on unmount */
  useEffect(() => {
    const worker = new Worker(
      new URL('../lib/simulation.worker.ts', import.meta.url)
    );

    worker.onmessage = ({ data }: MessageEvent<{ result: SimSummary; id: number }>) => {
      if (data.id !== reqId.current) return; // stale — a newer run is in flight
      startTransition(() => {
        setResult(data.result);
        setRunning(false);
      });
    };

    worker.onerror = () => setRunning(false);
    workerRef.current = worker;

    // Kick off the initial run immediately
    const id = ++reqId.current;
    setRunning(true);
    worker.postMessage({ params: DEFAULT_PARAMS, paths: 1000, id });

    return () => worker.terminate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Post a new task to the worker; tag it so stale results are dropped */
  const dispatch = useCallback((p: SimParams) => {
    if (!workerRef.current) return;
    const id = ++reqId.current;
    setRunning(true);
    workerRef.current.postMessage({ params: p, paths: 1000, id });
  }, []);

  /* Single-param change — debounced 300 ms so rapid slider drags coalesce */
  const setParam = useCallback(<K extends keyof SimParams>(key: K, val: SimParams[K]) => {
    const next = { ...paramsRef.current, [key]: val };
    paramsRef.current = next;
    setParamsState(next);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => dispatch(next), 300);
  }, [dispatch]);

  /* Full preset swap — runs immediately, no debounce */
  const setParams = useCallback((p: SimParams) => {
    paramsRef.current = p;
    setParamsState(p);
    if (debRef.current) clearTimeout(debRef.current);
    dispatch(p);
  }, [dispatch]);

  /* Manual re-run button — fires instantly with current params */
  const rerun = useCallback(() => {
    if (debRef.current) clearTimeout(debRef.current);
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
