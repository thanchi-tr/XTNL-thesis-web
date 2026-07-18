"use client";

/**
 * InsightCommandCenter — the Operational Risk Command Center.
 *
 * Terminal-grade, high data-ink telemetry. No pie charts, no smoothed area
 * graphs, no rounded SaaS stat cards. Every pixel encodes actionable risk.
 *
 *   §2  Strategist HUD — Systemic Entropy · Risk Attenuation · Containment · MTTR
 *   §4  OOS Tool Survivability Ledger — ranks mitigation assets worst-first
 *   §5  Taxonomic Decay Heatmap — categorical intensity over the ontology tree
 *   —   Anomaly ingestion cadence — right-angled bar sparkline
 *
 * Color is telemetry, not decoration:
 *   slate = passive/historical · cyan = OOS in-flight · emerald = homeostasis
 *   amber = unverified/attenuated · rose = systemic breach (draws the eye)
 */

import { useEffect, useMemo, useState } from "react";
import { TAXONOMY, toKmsStatus, type KmsStatus } from "@/lib/kms";

const SLATE = "#7f95ad", SLATE_HI = "#b3c2d4";
const CYAN = "#00b4ff", EMERALD = "#00cc7a", AMBER = "#f0a030", ROSE = "#f03a57";
const BASE = "var(--base,#04080f)", LINE = "var(--line,rgba(255,255,255,0.06))";
const LINE_HI = "var(--line-hi,rgba(255,255,255,0.11))";

interface InsightIssue {
  status: string;
  kms_status?: string | null;
  priority: number;
  impact_score: number;
  reopen_count: number;
  created_at: string;
  domain?: string | null;
  subsystem?: string | null;
  leaf_node?: string | null;
}

interface ToolRow {
  tool_id: string;
  name: string;
  category: string;
  version: string;
  deprecated: boolean;
  deployments: number;
  active_deployments: number;
  relapsed_deployments: number;
  effectiveness: number | null;
}

const DAY = 86_400_000;
const MONO = "var(--font-mono)";
const pw = (p: number) => 6 - Math.max(0, Math.min(5, p));   // DIRE(0)=6 … INFO(5)=1
const STATE_W: Record<string, number> = {
  RELAPSED: 1.0, TRIAGE_PENDING: 0.7, TOOL_QUEUED: 0.5, OOS_VALIDATION: 0.3, BASELINE_RESTORED: 0,
};

/* Right-angled bar sparkline — crisp edges, no smoothing. */
function Sparkbars({ values, color, height = 26 }: { values: number[]; color: string; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height }}>
      {values.map((v, i) => (
        <div key={i} title={`${v}`}
          style={{
            width: 6, height: Math.max(1.5, (v / max) * height), background: color,
            opacity: i === values.length - 1 ? 1 : 0.42, borderRadius: 0,
          }} />
      ))}
    </div>
  );
}

function Hud({ label, value, sub, color, pulse }: {
  label: string; value: string; sub?: string; color: string; pulse?: boolean;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 0, padding: "9px 11px", background: BASE, border: `1px solid ${LINE}`,
      display: "flex", flexDirection: "column", gap: 3,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.12em", color: SLATE_HI, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      <span
        className={pulse ? "kms-pulse" : undefined}
        style={{ fontFamily: MONO, fontSize: 19, fontWeight: 700, lineHeight: 1, color, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
      {sub && <span style={{ fontFamily: MONO, fontSize: 8.5, color: SLATE, letterSpacing: "0.04em" }}>{sub}</span>}
    </div>
  );
}

export default function InsightCommandCenter({ issues }: { issues: InsightIssue[] }) {
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [migrated, setMigrated] = useState(true);

  useEffect(() => {
    fetch("/api/session/tools")
      .then(r => r.json())
      .then(j => { setTools(j.tools ?? []); setMigrated(j.migrated !== false); })
      .catch(() => {});
  }, []);

  const m = useMemo(() => {
    const now = Date.now();
    const rows = issues.map(i => ({ ...i, k: toKmsStatus(i.kms_status, i.status) as KmsStatus }));

    // §2.1 Systemic Entropy Score
    let ses = 0;
    for (const r of rows)
      if (r.k === "TRIAGE_PENDING" || r.k === "OOS_VALIDATION" || r.k === "RELAPSED")
        ses += r.impact_score * pw(r.priority);

    // §2.2 Active Risk Attenuation — sizing cap implied by the anomaly load
    let load = 0;
    for (const r of rows)
      load += r.impact_score * pw(r.priority) * (STATE_W[r.k] ?? 0) * (1 + 0.25 * (r.reopen_count ?? 0));
    const sizingCap = Math.max(0.5, Math.min(1, 1 - load / 260));
    const alphaCost = (1 - sizingCap) * 100;

    // §2.3 Global Containment Rate
    const baselineN = rows.filter(r => r.k === "BASELINE_RESTORED").length;
    const relapsedN = rows.filter(r => r.k === "RELAPSED").length;
    const containment = baselineN + relapsedN > 0 ? (baselineN / (baselineN + relapsedN)) * 100 : 100;

    // §2.4 Mean Time To Relapse — mean containment-cycle lifespan of relapsed issues
    const relapsed = rows.filter(r => (r.reopen_count ?? 0) > 0);
    const mttr = relapsed.length > 0
      ? relapsed.reduce((s, r) => s + ((now - new Date(r.created_at).getTime()) / DAY) / r.reopen_count, 0) / relapsed.length
      : null;

    // §5 Taxonomic decay — per leaf node
    const leaf = new Map<string, { count: number; relapsed: number; pending: number; oos: number; baseline: number }>();
    for (const r of rows) {
      if (!r.leaf_node) continue;
      const c = leaf.get(r.leaf_node) ?? { count: 0, relapsed: 0, pending: 0, oos: 0, baseline: 0 };
      c.count++;
      if (r.k === "RELAPSED") c.relapsed++;
      else if (r.k === "TRIAGE_PENDING") c.pending++;
      else if (r.k === "OOS_VALIDATION" || r.k === "TOOL_QUEUED") c.oos++;
      else if (r.k === "BASELINE_RESTORED") c.baseline++;
      leaf.set(r.leaf_node, c);
    }

    // Ingestion cadence — anomalies logged per week, last 12 weeks
    const weeks = 12;
    const buckets = new Array(weeks).fill(0);
    for (const r of rows) {
      const age = now - new Date(r.created_at).getTime();
      const w = Math.floor(age / (7 * DAY));
      if (w >= 0 && w < weeks) buckets[weeks - 1 - w]++;
    }

    return { ses, sizingCap, alphaCost, containment, mttr, leaf, buckets, relapsedN };
  }, [issues]);

  const sesCol   = m.ses === 0 ? SLATE_HI : m.ses < 40 ? AMBER : ROSE;
  const capCol   = m.sizingCap >= 0.95 ? EMERALD : m.sizingCap >= 0.85 ? AMBER : ROSE;
  const contCol  = m.containment >= 92 ? EMERALD : m.containment >= 85 ? AMBER : ROSE;
  const mttrCol  = m.mttr === null ? SLATE_HI : m.mttr < 7 ? ROSE : m.mttr < 21 ? AMBER : EMERALD;

  const rankedTools = [...tools].sort((a, b) => {
    const av = a.effectiveness ?? 999, bv = b.effectiveness ?? 999;
    return av - bv;                                   // worst survival first
  });

  return (
    <div style={{ padding: "12px 12px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        @keyframes kmsPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        .kms-pulse { animation: kmsPulse 1.3s ease-in-out infinite; }
      `}</style>

      {/* ── §2 · Strategist HUD ── */}
      <div>
        <SectionLabel>STRATEGIST HUD · SYSTEMIC STATE</SectionLabel>
        <div style={{ display: "flex", gap: 6 }}>
          <Hud label="SYSTEMIC ENTROPY" value={String(Math.round(m.ses))} sub={m.ses === 0 ? "homeostatic" : m.ses < 40 ? "attenuated" : "critical load"}
            color={sesCol} pulse={m.ses >= 100} />
          <Hud label="SIZING CAP · δOPS" value={`${m.sizingCap.toFixed(3)}x`} sub={`−${m.alphaCost.toFixed(1)}% alpha / trade`} color={capCol} pulse={m.sizingCap < 0.85} />
          <Hud label="ALPHA CONTAINMENT" value={`${m.containment.toFixed(1)}%`} sub={m.containment < 85 ? "TOOLS FAILING" : "holding"} color={contCol} pulse={m.containment < 85} />
          <Hud label="MEAN TIME→RELAPSE" value={m.mttr === null ? "∞" : `${m.mttr.toFixed(1)}d`} sub={m.mttr === null ? "no breaches" : "cage lifespan"} color={mttrCol} />
        </div>
      </div>

      {/* ── §4 · OOS Tool Survivability Ledger ── */}
      <div>
        <SectionLabel>OOS TOOL SURVIVABILITY LEDGER</SectionLabel>
        {!migrated ? (
          <Empty>Digital Tool Registry offline — run kms_migration.sql</Empty>
        ) : rankedTools.length === 0 ? (
          <Empty>No mitigation assets registered</Empty>
        ) : (
          <div style={{ border: `1px solid ${LINE}`, background: BASE }}>
            <LedgerRow header cols={["TOOL ASSET", "TARGET", "DEPL", "OOS SURVIVAL", "STATE"]} />
            {rankedTools.map(t => {
              const eff = t.effectiveness;
              const [state, col] =
                t.deprecated               ? ["DEPRECATED",       SLATE]   as const :
                eff === null               ? ["UNPROVEN",         SLATE_HI] as const :
                eff < 50                   ? ["CRITICAL RELAPSE", ROSE]    as const :
                eff < 85                   ? ["ATTENUATED",       AMBER]   as const :
                                             ["BASELINE RESTORED", EMERALD] as const;
              return (
                <LedgerRow
                  key={t.tool_id}
                  cols={[
                    `${t.name} ${t.version}`,
                    t.category.toUpperCase(),
                    String(t.deployments),
                    eff === null ? "—" : `${eff.toFixed(1)}%`,
                    state,
                  ]}
                  colColors={[t.deprecated ? SLATE : SLATE_HI, SLATE_HI, SLATE_HI, col, col]}
                  strike={t.deprecated}
                  accent={col}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── §5 · Taxonomic Decay Heatmap ── */}
      <div>
        <SectionLabel>TAXONOMIC DECAY HEATMAP · ROOT-CAUSE ONTOLOGY</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {TAXONOMY.map(d => {
            const domainCount = d.subs.reduce((s, sub) =>
              s + sub.leaves.reduce((ss, l) => ss + (m.leaf.get(l.id)?.count ?? 0), 0), 0);
            const domainRelapse = d.subs.reduce((s, sub) =>
              s + sub.leaves.reduce((ss, l) => ss + (m.leaf.get(l.id)?.relapsed ?? 0), 0), 0);
            const domCol = domainRelapse > 0 ? ROSE : domainCount > 0 ? AMBER : SLATE;
            return (
              <div key={d.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: domCol }}>
                    {d.label.toUpperCase()}
                  </span>
                  <div style={{ flex: 1, height: 1, background: LINE }} />
                  <span style={{ fontFamily: MONO, fontSize: 9, color: domainCount > 0 ? domCol : SLATE_HI, fontVariantNumeric: "tabular-nums" }}>
                    {domainCount} anom{domainRelapse > 0 ? ` · ${domainRelapse} relapsed` : ""}
                  </span>
                </div>
                {d.subs.map(sub => (
                  <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", color: SLATE_HI, width: 118, flexShrink: 0, textAlign: "right", textTransform: "uppercase" }}>
                      {sub.label}
                    </span>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {sub.leaves.map(l => {
                        const c = m.leaf.get(l.id);
                        let col = "rgba(255,255,255,0.08)", glow = "none";
                        if (c) {
                          if (c.relapsed > 0)      { col = ROSE;    glow = `0 0 6px ${ROSE}88`; }
                          else if (c.pending > 0)  { col = AMBER; }
                          else if (c.oos > 0)      { col = CYAN; }
                          else if (c.baseline > 0) { col = EMERALD; }
                          const inten = Math.min(1, 0.4 + c.count * 0.22);
                          col = c.relapsed > 0 ? col : hexA(col, inten);
                        }
                        return (
                          <div key={l.id}
                            title={`${l.label}${c ? ` — ${c.count} (${c.relapsed} relapsed)` : " — clear"}`}
                            style={{ width: 15, height: 15, borderRadius: 2, background: col, boxShadow: glow, border: c ? "none" : `1px solid ${LINE}` }} />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Ingestion cadence ── */}
      <div>
        <SectionLabel>ANOMALY INGESTION · 12W CADENCE</SectionLabel>
        <div style={{ padding: "10px 12px", background: BASE, border: `1px solid ${LINE}`, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <Sparkbars values={m.buckets} color={m.relapsedN > 0 ? ROSE : CYAN} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: SLATE_HI, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
            {m.buckets.reduce((a, b) => a + b, 0)} logged / 12w
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── primitives ─────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em", color: SLATE_HI, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "16px 12px", background: BASE, border: `1px solid ${LINE}`, fontFamily: MONO, fontSize: 11, color: SLATE_HI, letterSpacing: "0.04em" }}>
      {children}
    </div>
  );
}

function LedgerRow({ cols, colColors, header, strike, accent }: {
  cols: string[]; colColors?: string[]; header?: boolean; strike?: boolean; accent?: string;
}) {
  const widths = ["1fr", "76px", "44px", "78px", "108px"];
  return (
    <div style={{
      display: "grid", gridTemplateColumns: widths.join(" "), gap: 8, alignItems: "center",
      padding: "7px 10px", borderBottom: header ? `1px solid ${LINE_HI}` : `1px solid ${LINE}`,
      borderLeft: !header && accent ? `2px solid ${accent}` : "2px solid transparent",
    }}>
      {cols.map((c, i) => (
        <span key={i} style={{
          fontFamily: MONO, fontVariantNumeric: "tabular-nums",
          fontSize: header ? 8.5 : 11, fontWeight: header ? 700 : (i === 0 ? 600 : 500),
          letterSpacing: header ? "0.1em" : "0.02em",
          color: header ? SLATE_HI : (colColors?.[i] ?? SLATE_HI),
          textAlign: i >= 2 && i <= 3 ? "right" : "left",
          textDecoration: strike && i === 0 ? "line-through" : "none",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {c}
        </span>
      ))}
    </div>
  );
}

/* Apply an alpha to a hex/known colour token for intensity ramps. */
function hexA(hex: string, a: number): string {
  const map: Record<string, [number, number, number]> = {
    [CYAN]: [0, 180, 255], [EMERALD]: [0, 204, 122], [AMBER]: [240, 160, 48], [ROSE]: [240, 58, 87],
  };
  const rgb = map[hex];
  if (!rgb) return hex;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(2)})`;
}
