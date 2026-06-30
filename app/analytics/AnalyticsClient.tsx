"use client";

import React, { useState, useCallback, useEffect } from "react";

/* ─── Types ─────────────────────────────────────────────── */

type Health = "[ELITE]" | "[SUPERB]" | "[EXCELLENT]" | "[ROBUST]" | "[STABLE]" | "[CAUTION]" | "[FAIL]";

interface CoreMetrics {
  sampleSize: number;
  sqn: number;
  expectancyMean: number;
  stdError: number;
  baseline95CiLower: number;
  sortino: number;
}

interface SecondaryMetrics {
  rollingSqnWeighted: number;
  profitFactor: number;
  skew: number;
  kurtosis: number | null;
  maxDdDurationTrades: number;
  mc95CVaR: number;
}

interface RDistRow { range: string; percent: number; cumulative: number; }

interface WfoFold {
  stage: string;
  trainSize: number | null;
  testSize: number | null;
  isSqn: number | null;
  oosSqn: number | null;
  isExpectancy: number | null;
  oosExpectancy: number | null;
  degradationPct: number | null;
  avgOosSqn: number | null;
  avgOosExpectancy: number | null;
  wfoStatus: string;
}

interface Section {
  id: string;
  label: string;
  core: CoreMetrics;
  secondary: SecondaryMetrics;
  recommendR: number;
  rVelocity24h: number;
  health: Health;
  rDist: RDistRow[];
  wfoFolds: WfoFold[];
  wfoStatus: string;
}

interface HourlyRow {
  hour: number;
  count: number;
  expectancy: number;
  winRate: number;
  tStat: number | null;
}

interface InferredMetrics {
  realisedR: number;
  perfectExecuteR: number;
  exemptROutsession: number;
  perfectCount: number;
  missedOrBadTrades: number;
  luckyTradesCount: number;
  luckyRTotal: number;
  captureRate: number;
  efficiencyRating: number;
  badTradePct: number;
  zActualSystem: number;
  zWeekToSystem: number;
  zCurrentToLong: number;
  recommendR: number;
  status: string;
}

interface ParsedReport {
  sections: Section[];
  inferred: InferredMetrics | null;
  hourly: Record<string, HourlyRow[]>;
}

/* ─── Parser ─────────────────────────────────────────────── */

function parseNum(s: string | undefined | null): number | null {
  if (s == null) return null;
  const v = parseFloat(s.trim());
  return isNaN(v) ? null : v;
}

/** Normalise line endings and strip trailing whitespace per line. */
function normaliseRaw(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(l => l.trimEnd())
    .join("\n");
}

/**
 * Split the report on dot-separator lines, then extract ===TITLE=== + body
 * from each chunk. Much more robust than scanning line-by-line.
 */
function extractSectionBlocks(raw: string): Array<{ title: string; body: string }> {
  const norm = normaliseRaw(raw);
  const out: Array<{ title: string; body: string }> = [];
  // Split on lines that are purely dots (20+ dots)
  const chunks = norm.split(/\n\.{20,}\n/);
  for (const chunk of chunks) {
    const lines = chunk.trim().split("\n");
    // Find first ===(20+)=== / title / ===(20+)=== triple
    for (let i = 0; i < lines.length - 2; i++) {
      if (/^={20,}$/.test(lines[i]) && /^={20,}$/.test(lines[i + 2])) {
        const title = lines[i + 1].trim();
        const body  = lines.slice(i + 3).join("\n");
        if (title) out.push({ title, body });
        break;
      }
    }
  }
  return out;
}

function splitCells(line: string): string[] {
  return line.split("|").map(c => c.trim()).filter(c => c.length > 0);
}

/** Find the first data row that appears after the line containing `keyword`. */
function dataRowAfter(body: string, keyword: string): string[] {
  const lines = body.split("\n");
  let armed = false;
  for (const line of lines) {
    if (line.toUpperCase().includes(keyword.toUpperCase())) {
      armed = true;
      continue;
    }
    if (!armed) continue;
    // Skip separator lines: all +, -, |
    if (/^[+|\-]+$/.test(line.trim())) continue;
    if (line.includes("|")) return splitCells(line);
  }
  return [];
}

function parseCoreMetrics(body: string): CoreMetrics | null {
  const r = dataRowAfter(body, "SAMPLE SIZE");
  if (r.length < 6) return null;
  return {
    sampleSize:        parseNum(r[0]) ?? 0,
    sqn:               parseNum(r[1]) ?? 0,
    expectancyMean:    parseNum(r[2]) ?? 0,
    stdError:          parseNum(r[3]) ?? 0,
    baseline95CiLower: parseNum(r[4]) ?? 0,
    sortino:           parseNum(r[5]) ?? 0,
  };
}

function parseSecondaryMetrics(body: string): SecondaryMetrics | null {
  const r = dataRowAfter(body, "ROLLING SQN WEIGHTED");
  if (r.length < 6) return null;
  const kurt = r[3]?.toLowerCase() === "nan" ? null : (parseNum(r[3]) ?? null);
  return {
    rollingSqnWeighted:  parseNum(r[0]) ?? 0,
    profitFactor:        parseNum(r[1]) ?? 0,
    skew:                parseNum(r[2]) ?? 0,
    kurtosis:            kurt,
    maxDdDurationTrades: parseNum(r[4]) ?? 0,
    mc95CVaR:            parseNum(r[5]) ?? 0,
  };
}

function parseDecisionRow(body: string): { recommendR: number; rVelocity24h: number; health: Health } {
  const r = dataRowAfter(body, "RECOMMEND R");
  const health = (r[2]?.trim() ?? "[STABLE]") as Health;
  return {
    recommendR:   parseNum(r[0]) ?? 0,
    rVelocity24h: parseNum(r[1]) ?? 0,
    health,
  };
}

function parseRDist(body: string): RDistRow[] {
  const lines = body.split("\n");
  const start = lines.findIndex(l => l.includes("R DIST"));
  if (start === -1) return [];
  const result: RDistRow[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l || l.startsWith(">>>") || l.startsWith("+") || l.startsWith("WFO")) break;
    if (/^-+$/.test(l) || l.toLowerCase().includes("r range")) continue;
    const parts = l.split(/\s{2,}/);
    if (parts.length >= 3) {
      result.push({
        range:      parts[0].trim(),
        percent:    parseNum(parts[1]) ?? 0,
        cumulative: parseNum(parts[2]) ?? 0,
      });
    }
  }
  return result;
}

function parseWfo(body: string): { folds: WfoFold[]; status: string } {
  const lines = body.split("\n");
  const wfoStart = lines.findIndex(l => l.includes(">>> WFO"));
  if (wfoStart === -1) return { folds: [], status: "" };

  const subLines = lines.slice(wfoStart + 1);
  if (subLines.some(l => l.includes("INSUFFICIENT_DATA"))) return { folds: [], status: "INSUFFICIENT_DATA" };

  // Keep only data rows (has |, not a separator line, not header)
  const dataRows = subLines.filter(l =>
    l.includes("|") &&
    !/^[+|\-]+$/.test(l.trim()) &&
    !/\bSTAGE\b/i.test(l)
  );

  const folds: WfoFold[] = [];
  let aggStatus = "";
  for (const row of dataRows) {
    const cells = splitCells(row);
    if (cells.length < 11) continue;
    const isAgg = cells[0].toLowerCase() === "aggregate";
    const fold: WfoFold = {
      stage:            cells[0].trim(),
      trainSize:        isAgg ? null : (parseNum(cells[1]) ?? null),
      testSize:         isAgg ? null : (parseNum(cells[2]) ?? null),
      isSqn:            isAgg ? null : (parseNum(cells[3]) ?? null),
      oosSqn:           isAgg ? null : (parseNum(cells[4]) ?? null),
      isExpectancy:     isAgg ? null : (parseNum(cells[5]) ?? null),
      oosExpectancy:    isAgg ? null : (parseNum(cells[6]) ?? null),
      degradationPct:   isAgg ? null : (parseNum(cells[7]) ?? null),
      avgOosSqn:        isAgg ? (parseNum(cells[8]) ?? null) : null,
      avgOosExpectancy: isAgg ? (parseNum(cells[9]) ?? null) : null,
      wfoStatus:        cells[10]?.trim() ?? "",
    };
    if (isAgg) aggStatus = fold.wfoStatus;
    folds.push(fold);
  }
  return { folds, status: aggStatus };
}

function parseInferred(body: string): InferredMetrics | null {
  const r1 = dataRowAfter(body, "REALISED R");
  const r2 = dataRowAfter(body, "LUCKY R TOTAL");
  const r3 = dataRowAfter(body, "Z CURRENT TO LONG");
  if (r1.length < 6 || r2.length < 6 || r3.length < 3) return null;
  return {
    realisedR:         parseNum(r1[0]) ?? 0,
    perfectExecuteR:   parseNum(r1[1]) ?? 0,
    exemptROutsession: parseNum(r1[2]) ?? 0,
    perfectCount:      parseNum(r1[3]) ?? 0,
    missedOrBadTrades: parseNum(r1[4]) ?? 0,
    luckyTradesCount:  parseNum(r1[5]) ?? 0,
    luckyRTotal:       parseNum(r2[0]) ?? 0,
    captureRate:       parseNum(r2[1]) ?? 0,
    efficiencyRating:  parseNum(r2[2]) ?? 0,
    badTradePct:       parseNum(r2[3]) ?? 0,
    zActualSystem:     parseNum(r2[4]) ?? 0,
    zWeekToSystem:     parseNum(r2[5]) ?? 0,
    zCurrentToLong:    parseNum(r3[0]) ?? 0,
    recommendR:        parseNum(r3[1]) ?? 0,
    status:            r3[2]?.trim() ?? "",
  };
}

function parseHourly(raw: string): Record<string, HourlyRow[]> {
  // Each hourly block is: ===\nTitle\n===\nData rows\n===
  // After split(/={30,}/), title and data land in consecutive separate blocks.
  // We use a pending-key to carry the title forward to the data block.
  const result: Record<string, HourlyRow[]> = {};
  const blocks = raw.split(/={30,}/);
  let pendingKey: string | null = null;
  for (const block of blocks) {
    const titleMatch = block.match(/Hourly R Distribution for (\S+)/);
    if (titleMatch) {
      pendingKey = titleMatch[1].replace(/:$/, ""); // strip trailing colon from report format
      continue;
    }
    if (!pendingKey) continue;
    // Data block: row format is  <idx> <hour> <count> <exp> <win_rate> <std_exp> <stderr> <t_stat>
    const rows: HourlyRow[] = [];
    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("hour") || /^=/.test(trimmed)) continue;
      const parts = trimmed.split(/\s+/);
      // parts[0] = pandas row index (numeric), parts[1] = hour, parts[2] = count ...
      if (parts.length >= 5 && !isNaN(Number(parts[0]))) {
        rows.push({
          hour:       parseInt(parts[1]),
          count:      parseInt(parts[2]),
          expectancy: parseFloat(parts[3]),
          winRate:    parseFloat(parts[4]),
          tStat:      parts.length >= 8 ? parseFloat(parts[7]) : null,
        });
      }
    }
    if (rows.length) result[pendingKey] = rows;
    pendingKey = null;
  }
  return result;
}

const SECTION_LABEL_MAP: Record<string, string> = {
  "SESSION_FILTERED_OPTIMAL_SAMPLE METRICS":                  "Session Filtered",
  "LIVE_SESSION_FILTERED_OPTIMAL_SAMPLE METRICS":             "Live Session",
  "95_R_SESSION_FILTERED_OPTIMAL_SAMPLE METRICS":             "95R Session Filtered",
  "THIS_WEEK_SESSION_FILTERED_OPTIMAL_SAMPLE METRICS":        "This Week (Session)",
  "THIS_WEEK_LIVE_PERFORMANCE METRICS":                       "This Week (Live)",
  "FULL_OPTIMAL_SAMPLE METRICS":                              "Full Optimal",
  "RECENT_60_FULL_OPTIMAL_SAMPLE METRICS":                    "Recent 60 Full",
  "RECENT_100_FULL_OPTIMAL_SAMPLE METRICS":                   "Recent 100 Full",
  "RECENT_200_FULL_OPTIMAL_SAMPLE METRICS":                   "Recent 200 Full",
  "RECENT_60_SESSION_FILTERED_OPTIMAL_SAMPLE METRICS":        "Recent 60 Session",
  "RECENT_100_SESSION_FILTERED_OPTIMAL_SAMPLE METRICS":       "Recent 100 Session",
  "95_R_RECENT_100_SESSION_FILTERED_OPTIMAL_SAMPLE METRICS":  "95R R100 Session",
  "RECENT_18_SESSION_FILTERED_OPTIMAL_SAMPLE METRICS":        "Recent 18 Session",
  "TAIL_ANCHOR_RECENT_18_SESSION_FILTERED_OPTIMAL_SAMPLE METRICS": "Tail Anchor R18",
  "REGIME_LABELED_MASTER METRICS":                            "Regime Master",
  "REGIME_ALPHA_FLOW METRICS":                                "Regime Alpha",
  "REGIME_TOXIC_FATIGUE METRICS":                             "Regime Toxic",
};

function parseReport(rawInput: string): ParsedReport {
  const raw = normaliseRaw(rawInput);
  const blocks = extractSectionBlocks(raw);
  const sections: Section[] = [];
  let inferred: InferredMetrics | null = null;

  for (const { title, body } of blocks) {
    if (title.includes("INFERRED METRICS")) {
      inferred = parseInferred(body);
      continue;
    }
    const label = SECTION_LABEL_MAP[title] ?? title.replace(" METRICS", "");
    const core = parseCoreMetrics(body);
    const secondary = parseSecondaryMetrics(body);
    if (!core || !secondary) continue;
    const dec = parseDecisionRow(body);
    const rDist = parseRDist(body);
    const { folds, status } = parseWfo(body);
    sections.push({
      id: title.replace(/\s+/g, "_").toLowerCase(),
      label,
      core,
      secondary,
      recommendR:   dec.recommendR,
      rVelocity24h: dec.rVelocity24h,
      health:       dec.health,
      rDist,
      wfoFolds:     folds,
      wfoStatus:    status,
    });
  }

  const hourly = parseHourly(raw);
  return { sections, inferred, hourly };
}

/* ─── UI helpers ─────────────────────────────────────────── */

const HEALTH_COLOR: Record<string, string> = {
  "[ELITE]":     "#00cc7a",
  "[SUPERB]":    "#00b86e",
  "[EXCELLENT]": "#34d399",
  "[ROBUST]":    "#22c4b0",
  "[STABLE]":    "#4d9cf5",
  "[CAUTION]":   "#f0a030",
  "[FAIL]":      "#f03a57",
};

const WFO_COLOR: Record<string, string> = {
  "ELITE - FULL_CAPITAL_DEPLOYMENT": "#00cc7a",
  "STABLE - OPERATIONAL_EDGE":       "#4d9cf5",
  "FAIL - CRITICAL_EDGE_DECAY":      "#f03a57",
  "INSUFFICIENT_DATA":               "#5a7490",
};

function healthColor(h: string) { return HEALTH_COLOR[h] ?? "#9ab0c8"; }
function wfoColor(s: string) {
  for (const [k, v] of Object.entries(WFO_COLOR)) if (s.includes(k)) return v;
  return WFO_COLOR[s] ?? "#5a7490";
}

function fmt(n: number | null, decimals = 3): string {
  if (n === null) return "—";
  return n.toFixed(decimals);
}

const ROW_ALT = "rgba(255,255,255,0.025)";
const CARD: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "16px 20px",
};

function MetricCard({ label, value, color, tooltip }: { label: string; value: string; color?: string; tooltip?: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ background: "var(--raised)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 12px", position: "relative", cursor: tooltip ? "help" : "default" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="mono" style={{ fontSize: 9, letterSpacing: "0.12em", color: "var(--ink-2)", marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: color ?? "var(--ink-0)" }}>{value}</div>
      {tooltip && hovered && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 300,
          width: 230, background: "rgba(4,8,15,0.97)", border: "1px solid var(--line-hi)",
          borderRadius: 6, padding: "9px 11px", pointerEvents: "none",
          fontSize: 11, color: "var(--ink-1)", lineHeight: 1.55,
          boxShadow: "0 8px 28px rgba(0,0,0,0.65)",
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

function MetricGrid({ items }: { items: Array<{ label: string; value: string; color?: string; tooltip?: string }> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
      {items.map(item => <MetricCard key={item.label} {...item} />)}
    </div>
  );
}

function MetricSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: "0.16em", color: "var(--ink-3)", marginBottom: 8, paddingBottom: 5, borderBottom: "1px solid var(--line)" }}>{label}</div>
      {children}
    </div>
  );
}

function HealthBadge({ health }: { health: string }) {
  const col = healthColor(health);
  return (
    <span
      className="mono"
      style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.10em",
        color: col,
        background: `${col}18`,
        border: `1px solid ${col}40`,
        borderRadius: 4, padding: "3px 8px",
      }}
    >
      {health.replace(/[\[\]]/g, "")}
    </span>
  );
}

function WfoBadge({ status }: { status: string }) {
  if (!status) return null;
  const col = wfoColor(status);
  const short = status === "INSUFFICIENT_DATA" ? "NO DATA"
    : status.replace("ELITE - ", "").replace("STABLE - ", "").replace("FAIL - ", "").replace(/_/g, " ");
  return (
    <span
      className="mono"
      style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
        color: col,
        background: `${col}15`,
        border: `1px solid ${col}35`,
        borderRadius: 4, padding: "3px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {short}
    </span>
  );
}

function RDistBar({ rows }: { rows: RDistRow[] }) {
  if (!rows.length) return <p style={{ color: "var(--ink-3)", fontSize: 12 }}>No R distribution data</p>;
  const maxPct = Math.max(...rows.map(r => r.percent));
  const isLoss = (r: string) => r.startsWith("-");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {rows.map((row, i) => {
        const loss = isLoss(row.range);
        const barColor = loss ? "var(--red)" : "var(--green)";
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-2)", width: 90, flexShrink: 0, textAlign: "right" }}>{row.range}</span>
            <div style={{ flex: 1, background: "var(--raised)", borderRadius: 2, height: 14, overflow: "hidden" }}>
              <div style={{ width: `${(row.percent / maxPct) * 100}%`, height: "100%", background: barColor, opacity: 0.75, borderRadius: 2 }} />
            </div>
            <span className="mono" style={{ fontSize: 10, color: loss ? "var(--red)" : "var(--green)", width: 44, textAlign: "right" }}>{row.percent.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function WfoTable({ folds, status }: { folds: WfoFold[]; status: string }) {
  if (status === "INSUFFICIENT_DATA") {
    return <span style={{ fontSize: 12, color: "var(--ink-2)" }} className="mono">INSUFFICIENT DATA</span>;
  }
  if (!folds.length) return null;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }} className="mono">
        <thead>
          <tr style={{ background: "var(--raised)" }}>
            {["Stage","Train","Test","IS SQN","OOS SQN","IS E","OOS E","Degrad%","Avg OOS SQN","Avg OOS E","Status"].map(h => (
              <th key={h} style={{ padding: "6px 8px", textAlign: "right", color: "var(--ink-2)", fontWeight: 600, borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {folds.map((f, i) => {
            const isAgg = f.stage.toLowerCase() === "aggregate";
            const bg = isAgg ? "rgba(77,156,245,0.06)" : (i % 2 === 0 ? "transparent" : ROW_ALT);
            const degradColor = f.degradationPct !== null ? (f.degradationPct > 50 ? "var(--red)" : f.degradationPct > 0 ? "var(--amber)" : "var(--green)") : "var(--ink-2)";
            return (
              <tr key={i} style={{ background: bg }}>
                <td style={{ padding: "5px 8px", color: isAgg ? "var(--blue)" : "var(--ink-1)", fontWeight: isAgg ? 700 : 400 }}>{f.stage}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-2)" }}>{f.trainSize ?? "—"}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-2)" }}>{f.testSize ?? "—"}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-1)" }}>{fmt(f.isSqn)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: f.oosSqn !== null ? (f.oosSqn > 1.5 ? "var(--green)" : f.oosSqn > 0 ? "var(--ink-1)" : "var(--red)") : "var(--ink-3)" }}>{fmt(f.oosSqn)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--ink-1)" }}>{fmt(f.isExpectancy)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: f.oosExpectancy !== null ? (f.oosExpectancy > 0 ? "var(--green)" : "var(--red)") : "var(--ink-3)" }}>{fmt(f.oosExpectancy)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: degradColor }}>{f.degradationPct !== null ? `${f.degradationPct.toFixed(1)}%` : "—"}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: f.avgOosSqn !== null ? (f.avgOosSqn > 1.5 ? "var(--green)" : "var(--ink-1)") : "var(--ink-3)" }}>{fmt(f.avgOosSqn)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: f.avgOosExpectancy !== null ? (f.avgOosExpectancy > 0 ? "var(--green)" : "var(--red)") : "var(--ink-3)" }}>{fmt(f.avgOosExpectancy)}</td>
                <td style={{ padding: "5px 8px" }}>
                  {isAgg ? <WfoBadge status={f.wfoStatus} /> : <span style={{ color: "var(--ink-3)", fontSize: 10 }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HourlyHeatmap({ rows }: { rows: HourlyRow[] }) {
  if (!rows.length) return null;
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.expectancy)));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {rows.map(row => {
        const norm = maxAbs > 0 ? row.expectancy / maxAbs : 0;
        const pos = norm > 0;
        const alpha = Math.min(0.9, Math.abs(norm) * 0.85 + 0.1);
        const bg = pos ? `rgba(0,204,122,${alpha})` : `rgba(240,58,87,${alpha})`;
        const textColor = Math.abs(norm) > 0.4 ? "rgba(0,0,0,0.85)" : "var(--ink-0)";
        return (
          <div key={row.hour} title={`H${row.hour}: E=${row.expectancy.toFixed(3)}, WR=${row.winRate.toFixed(1)}%, n=${row.count}`}
            style={{ width: 52, background: bg, borderRadius: 5, padding: "6px 4px", textAlign: "center", cursor: "default", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="mono" style={{ fontSize: 9, color: textColor, opacity: 0.8 }}>{String(row.hour).padStart(2, "0")}:00</div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: textColor }}>{row.expectancy.toFixed(2)}</div>
            <div className="mono" style={{ fontSize: 9, color: textColor, opacity: 0.7 }}>n={row.count}</div>
          </div>
        );
      })}
    </div>
  );
}

function SectionDetail({ s }: { s: Section }) {
  const [wfoOpen, setWfoOpen] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Status strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <HealthBadge health={s.health} />
        <WfoBadge status={s.wfoStatus} />
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>n={s.core.sampleSize}</span>
      </div>

      {/* ── SIGNAL: should I trade & at what size? ── */}
      <MetricSection label="SIGNAL">
        <MetricGrid items={[
          {
            label: "RECOMMEND R", value: fmt(s.recommendR, 4),
            color: s.recommendR > 0 ? "var(--green)" : "var(--red)",
            tooltip: "System-derived recommended position size in R for the next trade. Positive = take trades. Higher magnitude = stronger conviction from the edge model.",
          },
          {
            label: "R VELOCITY 24H", value: fmt(s.rVelocity24h, 3),
            color: "var(--blue)",
            tooltip: "Rate of cumulative R change over the last 24 hours. Positive and rising = edge is actively expressing. Declining or negative = momentum is fading.",
          },
          {
            label: "SQN", value: fmt(s.core.sqn),
            color: s.core.sqn > 2 ? "var(--green)" : s.core.sqn > 1 ? "var(--amber)" : "var(--red)",
            tooltip: "System Quality Number (Van Tharp). ≥2 = tradeable, ≥3 = excellent, ≥5 = world-class. Measures edge magnitude relative to trade-to-trade noise. Critical gatekeeper metric.",
          },
          {
            label: "ROLLING SQN W", value: fmt(s.secondary.rollingSqnWeighted),
            color: s.secondary.rollingSqnWeighted > 2 ? "var(--green)" : s.secondary.rollingSqnWeighted > 0 ? "var(--amber)" : "var(--red)",
            tooltip: "Recency-weighted rolling SQN. More sensitive to recent performance drift than the static SQN. Divergence between these two signals a potential regime shift.",
          },
        ]} />
      </MetricSection>

      {/* ── EDGE QUALITY: is the edge real and durable? ── */}
      <MetricSection label="EDGE QUALITY">
        <MetricGrid items={[
          {
            label: "EXPECTANCY", value: fmt(s.core.expectancyMean),
            tooltip: "Mean R per trade across the full sample — the average expected return per unit risked. Must remain positive for the system to generate long-run profit.",
          },
          {
            label: "PROFIT FACTOR", value: fmt(s.secondary.profitFactor),
            tooltip: "Gross profit ÷ gross loss across all trades. >1.5 = healthy, >2 = strong, >3 = exceptional. Below 1.0 means the system is net-losing.",
          },
          {
            label: "SORTINO", value: fmt(s.core.sortino),
            tooltip: "Return scaled by downside deviation only (unlike Sharpe, upside volatility is not penalised). Higher value = better downside-adjusted edge and asymmetric return profile.",
          },
          {
            label: "95CI LOWER", value: fmt(s.core.baseline95CiLower),
            color: s.core.baseline95CiLower > 0 ? "var(--green)" : "var(--red)",
            tooltip: "Lower bound of the 95% bootstrapped confidence interval on expectancy. Positive = statistically significant edge with 95% confidence. Red = edge not yet confirmed.",
          },
        ]} />
      </MetricSection>

      {/* ── RISK: what is the downside? ── */}
      <MetricSection label="RISK">
        <MetricGrid items={[
          {
            label: "MC 95% CVaR", value: fmt(s.secondary.mc95CVaR),
            color: "var(--red)",
            tooltip: "Monte Carlo Conditional Value at Risk at 95%. Expected loss in the worst 5% of simulated equity path sequences. Larger negative value = heavier tail risk in adverse scenarios.",
          },
          {
            label: "MAX DD TRADES", value: String(s.secondary.maxDdDurationTrades),
            color: "var(--amber)",
            tooltip: "Longest drawdown measured in trade count — the maximum number of consecutive trades required to recover a prior equity peak. Key psychological endurance metric.",
          },
          {
            label: "SKEW", value: fmt(s.secondary.skew),
            tooltip: "Asymmetry of the trade return distribution. Positive = fat right tail (occasional large wins). Negative = fat loss tail — harder to endure psychologically even with positive expectancy.",
          },
          {
            label: "KURTOSIS", value: s.secondary.kurtosis !== null ? fmt(s.secondary.kurtosis) : "nan",
            tooltip: "Tail heaviness vs a normal distribution. High positive kurtosis = more extreme outlier outcomes (both large wins and large losses) than a bell-curve would predict.",
          },
        ]} />
      </MetricSection>

      {/* R Distribution */}
      <div style={{ ...CARD, padding: "14px 18px" }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--ink-2)", marginBottom: 10 }}>R DISTRIBUTION</div>
        <RDistBar rows={s.rDist} />
      </div>

      {/* WFO */}
      <div style={CARD}>
        <button
          onClick={() => setWfoOpen(o => !o)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}
        >
          <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--ink-2)" }}>WFO WALK-FORWARD</span>
          <WfoBadge status={s.wfoStatus} />
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-3)" }}>{wfoOpen ? "▲" : "▼"}</span>
        </button>
        {wfoOpen && (
          <div style={{ marginTop: 14 }}>
            <WfoTable folds={s.wfoFolds} status={s.wfoStatus} />
          </div>
        )}
      </div>
    </div>
  );
}

function InferredCard({ m }: { m: InferredMetrics }) {
  const statusColor = m.status.includes("RISK") ? "var(--amber)" : m.status.includes("FAIL") ? "var(--red)" : "var(--green)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: statusColor }}>{m.status}</span>
      </div>

      {/* ── POSITIONING: what to do next ── */}
      <MetricSection label="POSITIONING">
        <MetricGrid items={[
          {
            label: "RECOMMEND R", value: fmt(m.recommendR, 3),
            color: m.recommendR > 0 ? "var(--green)" : "var(--amber)",
            tooltip: "Z-score-adjusted recommended position size derived from all three Z inputs. The final sizing output — directly actionable for the next trade.",
          },
          {
            label: "Z CURR→LONG", value: fmt(m.zCurrentToLong, 3),
            tooltip: "Z-score of current session performance vs the long-run system distribution. The primary driver of Recommend R. Negative = performing below long-run average right now.",
          },
          {
            label: "Z WEEK→SYS", value: fmt(m.zWeekToSystem, 3),
            tooltip: "Z-score of this week's cumulative performance vs long-run system mean. Catches multi-day drift that a single-session Z may miss.",
          },
          {
            label: "Z ACTUAL SYS", value: fmt(m.zActualSystem, 3),
            color: m.zActualSystem < 0 ? "var(--amber)" : "var(--green)",
            tooltip: "Z-score of realised (actual) performance vs long-run expectation. Captures real execution drift, not just signal-level performance — the ground-truth positioning input.",
          },
        ]} />
      </MetricSection>

      {/* ── EXECUTION: how well did I capture the available edge? ── */}
      <MetricSection label="EXECUTION">
        <MetricGrid items={[
          {
            label: "REALISED R", value: fmt(m.realisedR, 3),
            color: "var(--green)",
            tooltip: "Total R actually captured from executed trades this session. The ground truth of what the trader took home — the bottom line.",
          },
          {
            label: "PERFECT EXEC R", value: fmt(m.perfectExecuteR, 3),
            tooltip: "Theoretical R if every signal was executed at the optimal entry and exit. The ceiling of what was available to capture this session.",
          },
          {
            label: "CAPTURE RATE", value: fmt(m.captureRate, 3),
            tooltip: "Realised R ÷ Perfect Execution R. How much of the available edge was actually captured. 1.0 = perfect; below 0.8 = significant execution drag degrading edge.",
          },
          {
            label: "EFFICIENCY", value: fmt(m.efficiencyRating, 3),
            tooltip: "Composite execution quality score accounting for missed trades, bad trades, and lucky trades. Normalised efficiency of actual vs ideal execution across all dimensions.",
          },
        ]} />
      </MetricSection>

      {/* ── TRADE QUALITY: where is the edge leaking? ── */}
      <MetricSection label="TRADE QUALITY">
        <MetricGrid items={[
          {
            label: "PERFECT COUNT", value: String(m.perfectCount),
            tooltip: "Number of trades that met all entry, management, and exit criteria optimally. The trades that are directly advancing the system's edge.",
          },
          {
            label: "MISSED / BAD", value: String(m.missedOrBadTrades),
            color: m.missedOrBadTrades > 0 ? "var(--red)" : "var(--green)",
            tooltip: "Count of trades that were either missed opportunities or executed outside quality criteria. Each one represents an edge leak — a gap between signal and execution.",
          },
          {
            label: "BAD TRADE %", value: fmt(m.badTradePct, 3),
            color: m.badTradePct > 0.3 ? "var(--red)" : "var(--ink-1)",
            tooltip: "Fraction of all trades classified as poor-quality executions. Rising percentage indicates execution discipline is degrading and actively eroding the statistical edge.",
          },
          {
            label: "EXEMPT R", value: fmt(m.exemptROutsession, 3),
            tooltip: "R from trades taken outside designated session hours. Excluded from performance scoring. Non-zero values indicate out-of-hours activity that bypasses the system's conditions.",
          },
        ]} />
      </MetricSection>
    </div>
  );
}

/* ─── Summary overview panel ─────────────────────────────── */

function SummaryPanel({ sections }: { sections: Section[] }) {
  const key = sections.find(s => s.label === "Session Filtered") ?? sections[0];
  const live = sections.find(s => s.label === "Live Session");
  const week = sections.find(s => s.label === "This Week (Session)");
  if (!key) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 24 }}>
      {[key, live, week].filter(Boolean).map((s, i) => s && (
        <div key={i} style={{ ...CARD, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: "0.12em", color: "var(--ink-2)" }}>{s.label.toUpperCase()}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <HealthBadge health={s.health} />
            <WfoBadge status={s.wfoStatus} />
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div>
              <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>REC R</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: s.recommendR > 0 ? "var(--green)" : "var(--red)" }}>{fmt(s.recommendR, 4)}</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>VELOCITY</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--blue)" }}>{fmt(s.rVelocity24h, 2)}</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>SQN</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: s.core.sqn > 2 ? "var(--green)" : "var(--amber)" }}>{fmt(s.core.sqn)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main client ─────────────────────────────────────────── */

const SESSION_KEY = "xtnl_analytics_raw";

export default function AnalyticsClient({ user }: { user: { email?: string; name?: string } }) {
  const [raw, setRaw] = useState(() =>
    typeof window !== "undefined" ? (sessionStorage.getItem(SESSION_KEY) ?? "") : ""
  );
  const [report, setReport] = useState<ParsedReport | null>(null);
  const [activeSection, setActiveSection] = useState<string>("");
  const [activeHourly, setActiveHourly] = useState<string>("");
  const [inputOpen, setInputOpen] = useState(true);
  const [parseError, setParseError] = useState("");
  const [sessionRestored, setSessionRestored] = useState(false);

  /* Persist raw text to sessionStorage whenever it changes */
  useEffect(() => {
    if (raw) sessionStorage.setItem(SESSION_KEY, raw);
    else sessionStorage.removeItem(SESSION_KEY);
  }, [raw]);

  /* Auto-parse once on mount if a previous session's report is in storage */
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return;
    try {
      const parsed = parseReport(saved);
      if (parsed.sections.length || parsed.inferred) {
        setReport(parsed);
        setActiveSection(parsed.sections[0]?.id ?? "inferred");
        setActiveHourly(Object.keys(parsed.hourly)[0] ?? "");
        setInputOpen(false);
        setSessionRestored(true);
      }
    } catch { /* silently skip — user can re-paste */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  const handleParse = useCallback(() => {
    setParseError("");
    try {
      const parsed = parseReport(raw);
      if (!parsed.sections.length && !parsed.inferred) {
        setParseError("Could not parse any sections — check report format.");
        return;
      }
      setReport(parsed);
      setActiveSection(parsed.sections[0]?.id ?? "inferred");
      const hourlyKeys = Object.keys(parsed.hourly);
      setActiveHourly(hourlyKeys[0] ?? "");
      setInputOpen(false);
    } catch (e) {
      setParseError("Parse error: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [raw]);

  const currentSection = report?.sections.find(s => s.id === activeSection);
  const hourlyKeys = report ? Object.keys(report.hourly) : [];

  return (
    <div style={{ paddingTop: "calc(var(--nav-h) + 28px)", minHeight: "100vh", background: "var(--base)" }}>
      <div className="site-container" style={{ paddingBottom: 60 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
            <h1 className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.12em", color: "var(--ink-0)" }}>
              ANALYTICS
            </h1>
            <span className="mono" style={{ fontSize: 9, letterSpacing: "0.14em", color: "var(--ink-3)" }}>
              SYSTEM REPORT VISUALISER
            </span>
          </div>
          <div style={{ height: 1, background: "var(--line)" }} />
        </div>

        {/* Input panel */}
        <div style={{ ...CARD, marginBottom: 24 }}>
          <button
            onClick={() => setInputOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", marginBottom: inputOpen ? 14 : 0 }}
          >
            <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--ink-2)" }}>REPORT INPUT</span>
            {report && <span className="mono" style={{ fontSize: 9, color: "var(--green)" }}>● {report.sections.length} sections parsed</span>}
            {sessionRestored && !inputOpen && (
              <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>session memory</span>
            )}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-3)" }}>{inputOpen ? "▲" : "▼"}</span>
          </button>

          {inputOpen && (
            <>
              <textarea
                value={raw}
                onChange={e => setRaw(e.target.value)}
                placeholder={"Paste full system report here…"}
                spellCheck={false}
                style={{
                  width: "100%", height: 180,
                  background: "var(--raised)", border: "1px solid var(--line)",
                  borderRadius: 6, padding: "10px 12px", resize: "vertical",
                  color: "var(--ink-1)", fontSize: 11, fontFamily: "var(--font-mono), monospace",
                  outline: "none",
                }}
              />
              {parseError && (
                <p className="mono" style={{ fontSize: 11, color: "var(--red)", marginTop: 6 }}>{parseError}</p>
              )}
              <div className="analytics-btn-row">
                <button
                  onClick={handleParse}
                  disabled={!raw.trim()}
                  className="btn btn-primary"
                  style={{ fontSize: 11, padding: "7px 20px", opacity: raw.trim() ? 1 : 0.4 }}
                >
                  Parse Report
                </button>
                {report && (
                  <button
                    onClick={() => {
                      setReport(null);
                      setRaw("");
                      setInputOpen(true);
                      setSessionRestored(false);
                      setParseError("");
                      sessionStorage.removeItem(SESSION_KEY);
                    }}
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: "7px 14px" }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Results */}
        {report && (
          <>
            {/* Summary */}
            <SummaryPanel sections={report.sections} />

            {/* Inferred metrics banner */}
            {report.inferred && (
              <div style={{ ...CARD, marginBottom: 24, borderColor: report.inferred.status.includes("RISK") ? "var(--amber)" : "var(--line)" }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--ink-2)", marginBottom: 12 }}>INFERRED METRICS</div>
                <InferredCard m={report.inferred} />
              </div>
            )}

            {/* Two-column layout: sidebar + detail */}
            <div className="analytics-2col">
              {/* Sidebar — vertical list on desktop, horizontal pill-strip on mobile */}
              <div className="analytics-nav">
                {report.sections.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: activeSection === s.id ? "var(--raised)" : "transparent",
                      border: `1px solid ${activeSection === s.id ? "var(--line-hi)" : "transparent"}`,
                      borderRadius: 6, padding: "7px 10px", cursor: "pointer",
                      textAlign: "left", transition: "background 0.15s",
                      whiteSpace: "nowrap", flexShrink: 0, gap: 8,
                    }}
                  >
                    <span className="mono" style={{ fontSize: 10, color: activeSection === s.id ? "var(--ink-0)" : "var(--ink-2)", letterSpacing: "0.04em" }}>
                      {s.label}
                    </span>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: healthColor(s.health), flexShrink: 0 }} />
                  </button>
                ))}

                {hourlyKeys.length > 0 && (
                  <>
                    <div className="analytics-nav-divider" style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
                    <p className="mono analytics-nav-label" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.10em", padding: "0 10px", marginBottom: 4 }}>HOURLY R</p>
                    {hourlyKeys.map(k => (
                      <button
                        key={k}
                        onClick={() => { setActiveSection("__hourly__"); setActiveHourly(k); }}
                        style={{
                          background: activeSection === "__hourly__" && activeHourly === k ? "var(--raised)" : "transparent",
                          border: `1px solid ${activeSection === "__hourly__" && activeHourly === k ? "var(--line-hi)" : "transparent"}`,
                          borderRadius: 6, padding: "7px 10px", cursor: "pointer", textAlign: "left",
                          whiteSpace: "nowrap", flexShrink: 0,
                        }}
                      >
                        <span className="mono" style={{ fontSize: 9, color: activeSection === "__hourly__" && activeHourly === k ? "var(--blue)" : "var(--ink-2)", letterSpacing: "0.04em" }}>
                          {k.replace(/_/g, " ").replace("full optimal sample", "").trim()}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Detail */}
              <div style={CARD}>
                {activeSection === "__hourly__" && activeHourly && report.hourly[activeHourly] ? (
                  <>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--ink-2)", marginBottom: 14 }}>
                      HOURLY R — {activeHourly.replace(/_/g, " ").toUpperCase()}
                    </div>
                    <HourlyHeatmap rows={report.hourly[activeHourly]} />
                    <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 12 }}>Hover cells for detail. Green = positive expectancy, red = negative.</p>
                  </>
                ) : currentSection ? (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
                      <h2 className="mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.10em", color: "var(--ink-0)" }}>
                        {currentSection.label.toUpperCase()}
                      </h2>
                    </div>
                    <SectionDetail s={currentSection} />
                  </>
                ) : (
                  <p style={{ color: "var(--ink-3)", fontSize: 12 }}>Select a section from the left.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
