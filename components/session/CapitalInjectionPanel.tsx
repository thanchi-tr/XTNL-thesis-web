"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { useSession } from "next-auth/react";

/* Flat outlined primary-action style — matches the /session and /analytics
   route convention (replaces the solid-fill .btn-primary gradient pill). */
const FLAT_SUBMIT: CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(0,204,122,0.35)",
  borderRadius: 5,
  color: "var(--green)",
  fontWeight: 700,
  fontFamily: "var(--font-mono), monospace",
  textTransform: "lowercase",
  cursor: "pointer",
};

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden style={{ animation: "spin-cip 0.7s linear infinite", flexShrink: 0 }}>
      <style>{`@keyframes spin-cip { to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5"/>
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

interface CapitalState {
  weekId:        number | null;
  streak:        number;
  cumulateFund:  number;
  deployFund:    boolean;
  defaultFund:   number;
  scalingFactor: number;
  deployable:    boolean;
  threshold:     number;
}

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Governance page → Capital Injection panel (strategist/fund_manager only).
 * Reads live streak/cumulative-fund state from system_memory_ledger (owned
 * by the Python pipeline) plus the strategist-configured default fund, and
 * lets the strategist deploy capital once the streak has unlocked it
 * (streak >= threshold — mirrors the ">= 4" unlock in memory_generator.py /
 * report_generator.py). Deploying resets streak to 0 and cumulate_fund back
 * to the strategist's default — see app/api/session/capital-injection/route.ts.
 */
export default function CapitalInjectionPanel() {
  const { data: session } = useSession();
  const roles: string[] = (session as any)?.roles ?? [];
  const canManage = roles.some(r => ["strategist", "fund_manager"].includes(r));

  const [state,   setState]   = useState<CapitalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [defaultDraft, setDefaultDraft] = useState("");
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultMsg, setDefaultMsg] = useState<string | null>(null);
  const [defaultErr, setDefaultErr] = useState<string | null>(null);

  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState<string | null>(null);
  const [deployErr, setDeployErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/session/capital-injection");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Failed to load capital state");
      setState(j as CapitalState);
      setDefaultDraft(String(j.defaultFund));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (canManage) void load(); }, [canManage, load]);

  const saveDefault = async () => {
    const val = Number(defaultDraft);
    setDefaultMsg(null);
    setDefaultErr(null);
    if (!Number.isFinite(val) || val <= 0) {
      setDefaultErr("Enter a positive number");
      return;
    }
    setSavingDefault(true);
    try {
      const r = await fetch("/api/session/capital-injection", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultFund: val }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Failed to save");
      setDefaultMsg(`Default fund set to ${money(val)}.`);
      setState(prev => prev ? { ...prev, defaultFund: val } : prev);
    } catch (e) {
      setDefaultErr(e instanceof Error ? e.message : "Failed to save");
    }
    setSavingDefault(false);
  };

  const deploy = async () => {
    setDeployMsg(null);
    setDeployErr(null);
    setDeploying(true);
    try {
      const r = await fetch("/api/session/capital-injection", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Failed to deploy capital");
      setDeployMsg(`Deployed — streak reset to 0, fund reset to ${money(j.cumulateFund)}.`);
      await load();
    } catch (e) {
      setDeployErr(e instanceof Error ? e.message : "Failed to deploy");
    }
    setDeploying(false);
  };

  if (!canManage) {
    return <p style={{ color: "var(--ink-3)", fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>Strategist privilege required.</p>;
  }
  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Spinner size={22} /></div>;
  }
  if (error || !state) {
    return <p style={{ color: "var(--red)", fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>{error ?? "No data."}</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-3)", textTransform: "uppercase" as const }}>
          Capital State — week_id {state.weekId ?? "—"}
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>

      {/* Metric row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 12px" }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: "0.12em", color: "var(--ink-2)", marginBottom: 4 }}>CURRENT STREAK</div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-0)" }}>{state.streak} weeks</div>
        </div>
        <div style={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 12px" }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: "0.12em", color: "var(--ink-2)", marginBottom: 4 }}>CUMULATIVE FUND</div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-0)" }}>{money(state.cumulateFund)}</div>
        </div>
        <div style={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 12px" }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: "0.12em", color: "var(--ink-2)", marginBottom: 4 }}>SCALING FACTOR</div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-0)" }}>{state.scalingFactor.toFixed(3)}×</div>
        </div>
        <div style={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 12px" }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: "0.12em", color: "var(--ink-2)", marginBottom: 4 }}>INJECTION STATUS</div>
          <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: state.deployable ? "var(--green)" : "var(--amber)" }}>
            {state.deployable ? "UNLOCKED" : `LOCKED (${state.streak}/${state.threshold})`}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 20, lineHeight: 1.6 }}>
        The scaling factor compounds the cumulative fund at 1.20× while the streak holds, and is
        damped by 0.025 per week once the streak exceeds 4 (volatility shield) — so leaving the
        fund deployed longer past that point earns a progressively smaller multiplier. Injection
        unlocks once the streak reaches {state.threshold}+ consecutive weeks.
      </p>

      {/* Strategist default fund */}
      <div style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "14px 16px", marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-3)", textTransform: "uppercase" as const, marginBottom: 10 }}>
          Strategist Default Fund
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "0 0 12px" }}>
          Deploying capital resets the cumulative fund to this amount. Current default: <strong style={{ color: "var(--ink-1)" }}>{money(state.defaultFund)}</strong>.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={defaultDraft}
            onChange={e => setDefaultDraft(e.target.value)}
            style={{ width: 140, background: "var(--sub)", border: "1px solid var(--line-hi)", borderRadius: 6, padding: "8px 10px", fontSize: 12.5, color: "var(--ink-0)", outline: "none" }}
          />
          <button type="button" onClick={saveDefault} disabled={savingDefault} className="btn btn-ghost" style={{ fontSize: 11, padding: "7px 14px" }}>
            {savingDefault ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner size={11} /> Saving…</span> : "Set Default"}
          </button>
          {defaultMsg && <span style={{ fontSize: 11, color: "var(--green)" }}>✓ {defaultMsg}</span>}
          {defaultErr && <span style={{ fontSize: 11, color: "var(--red)" }}>{defaultErr}</span>}
        </div>
      </div>

      {/* Deploy */}
      <div style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "14px 16px" }}>
        <div className="mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-3)", textTransform: "uppercase" as const, marginBottom: 10 }}>
          Deploy Capital
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "0 0 12px" }}>
          Resets streak to 0 and the cumulative fund back to the default above. Only available once the streak reaches {state.threshold}+.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={deploy}
            disabled={!state.deployable || deploying}
            style={{ ...FLAT_SUBMIT, padding: "9px 20px", fontSize: 12, opacity: !state.deployable ? 0.5 : 1, cursor: !state.deployable ? "not-allowed" : "pointer" }}
          >
            {deploying ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner /> Deploying…</span> : "Deploy"}
          </button>
          {deployMsg && <span style={{ fontSize: 11.5, color: "var(--green)" }}>✓ {deployMsg}</span>}
          {deployErr && <span style={{ fontSize: 11.5, color: "var(--red)" }}>{deployErr}</span>}
        </div>
      </div>
    </div>
  );
}
