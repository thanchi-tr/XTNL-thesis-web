"use client";

import { useState, useEffect, type FormEvent } from "react";

const IS_DEV = process.env.NODE_ENV === "development";

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
type User = { email: string; name: string };
type Mode = "operator" | "analyst";

export type FrictionReport = {
  ts:       string;
  state:    { mode: string; streak: string; streakNote: string; injection: string; locked: boolean; scaling: string; deployment: string };
  exec:     { rating: number; label: "ELITE" | "ON-PAR" | "SUB-PAR"; leakage: number; forgiven: number; luckyR: number; capture: number; exemptions: number };
  edge:     { sqn: number; stressSqn: number; decay: number; decayLabel: string; risk: string };
  mirror:   string;
  flaws:    string[];
  handover: string;
  updates:  string[];
};

/* ═══════════════════════════════════════════════════════════
   ONEDRIVE REPORT PARSER
   ─ Parses the plain-text institutional audit format.
   ─ Feed the raw .txt content fetched from OneDrive here.
═══════════════════════════════════════════════════════════ */
export function parseFrictionReport(raw: string): FrictionReport {
  /* Pull a single * key : value line */
  const val = (key: string) =>
    raw.match(new RegExp(`\\*\\s*${key.replace(/[/()]/g, "\\$&")}\\s*:\\s*(.+)`))?.[1]?.trim() ?? "";

  /* ── Header ────────────────────────────────────────── */
  const ts        = raw.match(/TIMESTAMP:\s*(.+)/)?.[1]?.trim() ?? "";
  const stateMode = raw.match(/\[SYSTEM STATE\]\s*::\s*(.+)/)?.[1]?.trim() ?? "";
  const streakNote= raw.match(/\*\*(.+)/)?.[1]?.trim() ?? "";

  /* ── System State ──────────────────────────────────── */
  const injectRaw = val("Planned Injection\\/deposit");
  const injection = injectRaw.replace(/\s*\(.*\)/, "").trim();
  const locked    = /LOCKED/i.test(injectRaw);

  /* ── Execution Truth ───────────────────────────────── */
  const ratingRaw = val("Rating");
  const rating    = parseFloat(ratingRaw) || 0;
  const rawLabel  = ratingRaw.match(/\[([A-Z\-]+)\]/)?.[1] ?? "SUB-PAR";
  const label     = (["ELITE","ON-PAR","SUB-PAR"].includes(rawLabel) ? rawLabel : "SUB-PAR") as FrictionReport["exec"]["label"];
  const leakRaw   = val("Profit Leakage");
  const leakage   = parseFloat(leakRaw) || 0;
  const forgiven  = parseFloat(leakRaw.match(/ADJUSTED:\s*([\d.]+)/)?.[1] ?? "0") || 0;
  const luckyR    = parseFloat(val("Lucky R Total")) || 0;
  const capRaw    = val("Capture Rate");
  const capture   = parseFloat(capRaw) || 0;
  const exemptions= parseFloat(capRaw.match(/ADJUSTED:\s*([\d.]+)/)?.[1] ?? "0") || 0;

  /* ── Probabilistic Edge ────────────────────────────── */
  const sqn       = parseFloat(val("System SQN")) || 0;
  const stressSqn = parseFloat(val("95% Stress SQN")) || 0;
  const decayRaw  = val("Edge Decay");
  const decay     = parseFloat(decayRaw) || 0;
  const decayLabel= decayRaw.match(/\((.+)\)/)?.[1]?.trim() ?? "";
  const risk      = val("Target Risk");

  /* ── Mirror section ─────────────────────────────────── */
  const mirrorBlock = raw.split(/\[THE MIRROR.*?\]/i)[1]?.split(/\[SYSTEM FRICTION/i)[0] ?? "";
  /* Strip "Radical Candor:" prefix that sometimes appears after REVIEW: */
  const reviewRaw = mirrorBlock.match(/REVIEW:\s*([\s\S]+?)(?=\nDETECTED FLAWS|\nHANDOVER|$)/i)?.[1]?.trim() ?? "";
  const mirror    = reviewRaw.replace(/^Radical Candor:\s*/i, "").trim();
  const handover  = mirrorBlock.match(/HANDOVER NOTES:\s*([\s\S]+?)(?=\n={5,}|$)/i)?.[1]?.trim().replace(/",\s*$/, "") ?? "";

  /* Multi-line flaws — split on pipe-escaped newlines too */
  const flaws: string[] = [];
  for (const m of mirrorBlock.matchAll(/- \[([A-Z_]+)\]:\s*"([\s\S]+?)(?:"|$)/g)) {
    const text = m[2].split(/\|n/)[0].trim();
    flaws.push(`${m[1]}: ${text}`);
  }

  /* ── Friction updates ───────────────────────────────── */
  const updBlock  = raw.split(/\[SYSTEM FRICTION UPDATES\]/i)[1] ?? "";
  const updates   = [...updBlock.matchAll(/\*\s*(.+)/g)]
    .map(m => m[1].trim())
    .filter(Boolean);

  return {
    ts,
    state: {
      mode:       stateMode,
      streak:     val("Current Streak"),
      streakNote,
      injection,
      locked,
      scaling:    val("Scaling Factor").replace("x", "×"),
      deployment: val("Deployment"),
    },
    exec:  { rating, label, leakage, forgiven, luckyR, capture, exemptions },
    edge:  { sqn, stressSqn, decay, decayLabel, risk },
    mirror,
    flaws,
    handover,
    updates,
  };
}

/* ═══════════════════════════════════════════════════════════
   MOCK RAW REPORT  — replace body with OneDrive file content
═══════════════════════════════════════════════════════════ */
const MOCK_RAW_REPORT = `
==============================================================
   XTNLS INSTITUTIONAL AUDIT - PRE-SESSION MIRROR
   TIMESTAMP: 2026-06-27 14:33:00
==============================================================

[SYSTEM STATE] :: RISK REDUCE - FRICTIONAL BLEED
* Visualization             : - - - -
**After the 4th consecutive streak, the injection amount is unlocked
* Current Streak            : 0 Weeks
* Planned Injection/deposit : $2,400.00 (LOCKED)
* Scaling Factor            : 1.200x
* Deployment                : RESERVED

[EXECUTION TRUTH]
* Rating                    : 0.822 [SUB-PAR]
* Profit Leakage            : -4.91R  [ADJUSTED: 4.58R Forgiven]
* Lucky R Total             : 0.00R (Lucky warning)
* Capture Rate              : 100.0%  [ADJUSTED: 1.0 Exemptions]

[PROBABILISTIC EDGE]
* System SQN                : 3.98
* 95% Stress SQN            : 3.46
* Edge Decay                : 0.51 (Problem Outlier)
* Target Risk               : 0.5088 per trade

[THE MIRROR - LLM AUDIT]
REVIEW: Radical Candor: Your execution is failing due to severe focus degradation and on-the-fly rule invention. While the medical emergency with your wife is a valid and understandable exemption for the 24th and 25th, your behavior on the 22nd (misreading levels while distracted by dinner) and your ongoing gaming addiction during active hours are unacceptable for a high-performance system. You are masking a lack of discipline with 'grey areas' and inventing ATR-based justifications when structural rules are not met. The deployment of an OS blocker is a necessary crutch, but true symmetry requires internal steadfastness. You must stop fighting the wave and respect the session boundaries.

DETECTED FLAWS:
  - [RULE_VIOLATION]: "Recidivism detected: FOMO contamination across multiple sessions. Operator is imaging entries and acting on impulse.|nRecidivism detected: 'I have successfully overcome fomo' AND 'context switch cause him to fomo into a trade'"

HANDOVER NOTES: Operator is under extreme psychological stress due to a family medical crisis, which validates specific performance exemptions on the 24th and 25th. However, baseline discipline is fractured: gaming during sessions, distracted charting while eating, and inventing ATR-based entry rules on the fly to justify setups. External OS blockers have been deployed to enforce focus, but the operator's internal steadfastness is currently compromised.

[SYSTEM FRICTION UPDATES]
 * Mandatory 10-minute chart-sync protocol after returning from any break (e.g., dinner) before placing orders.
 * No entries allowed if the primary rule (body length) is unmet; ATR justifications are strictly banned.
 * All manual terminations require a pre-logged structural invalidation reason.

==============================================================
==============================================================
`;

/* Derived once at module level — swap source string to re-parse */
const FRICTION = parseFrictionReport(MOCK_RAW_REPORT);

/* ═══════════════════════════════════════════════════════════
   OTHER MOCK DATA  (replace with DB calls when wired)
═══════════════════════════════════════════════════════════ */
const OPTIMAL = [
  { id: "ad169a2b-83f2", r:  5.0000, entry: "Jun 26 · 12:15 PM", exit: "Jun 26 · 5:45 PM",  tradeId: "" },
  { id: "3295b9c2-ad8f", r:  8.2600, entry: "Jun 25 · 10:00 PM", exit: "Jun 26 · 1:33 AM",  tradeId: "250a8195-11f0-4535-8c…" },
  { id: "7a2b4c52-f4e9", r: -0.8000, entry: "Jun 25 · 4:00 PM",  exit: "Jun 25 · 5:15 PM",  tradeId: "" },
  { id: "963f9b17-2c34", r:  3.8300, entry: "Jun 24 · 11:00 AM", exit: "Jun 25 · 9:45 AM",  tradeId: "" },
  { id: "d2e6a363-ee5c", r: -0.7500, entry: "Jun 24 · 8:15 AM",  exit: "Jun 24 · 10:15 AM", tradeId: "" },
  { id: "2e945c00-21f4", r: -0.4800, entry: "Jun 24 · 3:15 AM",  exit: "Jun 24 · 10:15 AM", tradeId: "" },
  { id: "20c542d0-ca9b", r: -0.7430, entry: "Jun 23 · 8:46 PM",  exit: "Jun 23 · 8:46 PM",  tradeId: "ff726c2d-7ba0-41d0-a9d…" },
  { id: "83016614-0bb2", r:  0.0000, entry: "Jun 23 · 5:30 AM",  exit: "Jun 23 · 1:15 AM",  tradeId: "" },
  { id: "b23b5984-f5a6", r:  0.0000, entry: "Jun 22 · 10:15 AM", exit: "Jun 22 · 12:00 PM", tradeId: "" },
];

const JOURNAL = [
  { tradeId: "",                   time: "Jun 29 · 11:30 AM", analyst: false, content: "First anchor turn into an opportunity — feeling calm and focused today." },
  { tradeId: "",                   time: "Jun 26 · 2:38 AM",  analyst: true,  content: "OS blocker is working well. Operator is forced to sit and be diligent. He can watch movies freely — as long as he pays 100% attention when the session window opens. OS Wise firmware now alerts at session start." },
  { tradeId: "",                   time: "Jun 25 · 12:15 PM", analyst: false, content: "Got myself back together. Anchored my mind to the lock: −0.6R worst case, and the meaning of statistical sampling." },
  { tradeId: "250a8195-11f0-4535", time: "Jun 25 · 12:00 PM", analyst: true,  content: "Target setting discovered a loop hole — target was set but a grey area caused price to hesitate, leading to manual termination at Jun 25 · 10:00 PM." },
];

const TASKS = [
  { id: "ingestion", label: "Ingestion",       done: true,  ts: "Jun 30 · 06:00 AM" },
  { id: "analysis",  label: "Analysis Session", done: false, ts: null                },
];

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function rFmt(r: number)   { return r.toFixed(4) + "R"; }
function rColor(r: number) { return r > 0 ? "var(--green)" : r < 0 ? "var(--red)" : "var(--ink-2)"; }

/*
  Trading sessions (Melbourne local time):
    Session 1 — 18:00 → 19:00
    Session 2 — 20:00 → 01:00 (next day)
*/
type SessionStatus = {
  inSession:   boolean;
  sessionName: string;
  targetLabel: string; // "6:00 PM" / "7:00 PM" / "8:00 PM" / "1:00 AM"
  remainingSec: number;
};

function getSessionStatus(): SessionStatus {
  const now  = new Date();
  const md   = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const h = md.getHours(), m = md.getMinutes(), s = md.getSeconds();
  const tot  = h * 3600 + m * 60 + s;

  /* 00:00 – 01:00  →  Session 2 overnight, ends 1 AM */
  if (tot < 3600)
    return { inSession: true,  sessionName: "Session 2", targetLabel: "1:00 AM", remainingSec: 3600 - tot };

  /* 01:00 – 18:00  →  standby, next is Session 1 at 6 PM */
  if (tot < 18 * 3600)
    return { inSession: false, sessionName: "Session 1", targetLabel: "6:00 PM", remainingSec: 18 * 3600 - tot };

  /* 18:00 – 19:00  →  Session 1 active, ends 7 PM */
  if (tot < 19 * 3600)
    return { inSession: true,  sessionName: "Session 1", targetLabel: "7:00 PM", remainingSec: 19 * 3600 - tot };

  /* 19:00 – 20:00  →  standby, next is Session 2 at 8 PM */
  if (tot < 20 * 3600)
    return { inSession: false, sessionName: "Session 2", targetLabel: "8:00 PM", remainingSec: 20 * 3600 - tot };

  /* 20:00 – 24:00  →  Session 2 active, ends 1 AM next day */
  return { inSession: true, sessionName: "Session 2", targetLabel: "1:00 AM", remainingSec: 25 * 3600 - tot };
}

/*
  Accepts pasted text from the Optimal Sample table copy-cells
  (e.g. "Jun 26 · 12:15 PM") and returns a datetime-local string
  (YYYY-MM-DDTHH:MM) so it can be set directly on the input state.
  Falls back to null if the text can't be recognised.
*/
function parseFlexDatetime(raw: string): string | null {
  const s = raw.trim();
  const pad = (n: number) => String(n).padStart(2, "0");

  /* Already in datetime-local format */
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) {
    const [date, time] = s.split(/[T ]/, 2);
    return `${date}T${time.slice(0, 5)}`;
  }

  /* Strip middle-dot separator used by table cells ("Jun 26 · 12:15 PM") */
  const cleaned = s.replace(/\s*[·•]\s*/g, " ").replace(/,/g, "").trim();

  /* Append current year if no 4-digit year present */
  const withYear = /\b20\d{2}\b/.test(cleaned)
    ? cleaned
    : `${cleaned} ${new Date().getFullYear()}`;

  const d = new Date(withYear);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return null;
}

function fmtHMS(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}

function getGreeting(name: string, hour: number) {
  const first = name.split(" ")[0] || name;
  if (hour >= 5  && hour < 12) return `Good morning, ${first}`;
  if (hour >= 12 && hour < 17) return `Good afternoon, ${first}`;
  if (hour >= 17 && hour < 21) return `Good evening, ${first}`;
  return `Working late, ${first}`;
}

function melbNow() {
  const now = new Date();
  const md  = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const day = md.getDay(), hour = md.getHours();
  const timeStr = now.toLocaleTimeString("en-AU", { timeZone: "Australia/Melbourne", hour: "2-digit", minute: "2-digit", hour12: true });
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return { mode: (day === 0 || (day === 6 && hour >= 1) ? "analyst" : "operator") as Mode, hour, dayStr: days[day], timeStr };
}

/* ═══════════════════════════════════════════════════════════
   STYLE ATOMS
═══════════════════════════════════════════════════════════ */
const INP = { width: "100%", boxSizing: "border-box" as const, background: "var(--sub)", border: "1px solid var(--line-hi)", borderRadius: 5, padding: "9px 11px", fontSize: 12.5, color: "var(--ink-0)", outline: "none", fontFamily: "inherit" };
const LBL = { display: "block", fontSize: 10.5, fontWeight: 600, color: "var(--ink-2)", letterSpacing: "0.05em", textTransform: "uppercase" as const, marginBottom: 5 };
const TH  = { textAlign: "left" as const, padding: "8px 12px", fontSize: 10.5, fontWeight: 600, color: "var(--ink-2)", letterSpacing: "0.05em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const, borderBottom: "1px solid var(--line-hi)" };
const TD  = { padding: "9px 12px", fontSize: 12.5, color: "var(--ink-1)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" as const, borderBottom: "1px solid var(--line)" };

/* ═══════════════════════════════════════════════════════════
   TASK PILL
═══════════════════════════════════════════════════════════ */
function TaskPill({ done, label, ts }: { done: boolean; label: string; ts: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 10px", borderRadius: 4, border: `1px solid ${done ? "rgba(0,204,122,0.22)" : "var(--line)"}`, background: done ? "var(--green-06)" : "var(--sub)" }}>
      {done
        ? <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden><circle cx="6" cy="6" r="5.5" stroke="var(--green)" strokeWidth="1"/><path d="M3.5 6l1.8 1.8 3-3.6" stroke="var(--green)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        : <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid var(--ink-3)", flexShrink: 0 }} />
      }
      <span style={{ fontSize: 11, fontWeight: 600, color: done ? "var(--green)" : "var(--ink-2)", letterSpacing: "0.02em" }}>{label}</span>
      {done && ts  && <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{ts}</span>}
      {!done       && <span style={{ fontSize: 10, color: "var(--ink-3)", fontStyle: "italic" }}>pending</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CARD HEADER
═══════════════════════════════════════════════════════════ */
function CardHeader({ eyebrow, eyebrowColor, title, badge, actions, right }: {
  eyebrow?: string; eyebrowColor?: string; title: string;
  badge?: React.ReactNode; actions?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {eyebrow && <span className="section-eyebrow" style={{ color: eyebrowColor ?? "var(--green)" }}>{eyebrow}</span>}
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)", letterSpacing: "-0.01em" }}>{title}</span>
        {badge}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{right}{actions}</div>
    </div>
  );
}

function IconBtn({ icon }: { icon: "filter" | "download" | "refresh" }) {
  return (
    <button type="button" style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "var(--ink-3)", display: "flex", alignItems: "center" }}>
      {icon === "filter"   && <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 8h6M7 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>}
      {icon === "download" && <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      {icon === "refresh"  && <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M13 8A5 5 0 1 1 8 3h3.5M11.5 3v3.5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   OPTIMAL TRADE TABLE
═══════════════════════════════════════════════════════════ */
function OptimalTable({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const [hov,       setHov]       = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function copy(key: string, text: string, e: React.MouseEvent) {
    if (!text || text === "—") return;
    e.stopPropagation();
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1400);
  }

  /* Copyable <td>: stops propagation so row-select doesn't fire */
  function CopyTd({ id, field, value, baseStyle }: {
    id: string; field: string; value: string; baseStyle?: React.CSSProperties;
  }) {
    const key       = `${id}-${field}`;
    const active    = copiedKey === key;
    const copyable  = value !== "—";
    return (
      <td
        onClick={e => copy(key, value, e)}
        title={copyable ? "Click to copy" : undefined}
        style={{
          ...TD, ...baseStyle,
          cursor: copyable ? "copy" : "default",
          color: active ? "var(--green)" : (baseStyle?.color ?? "var(--ink-1)"),
          transition: "color 0.15s",
          userSelect: "none" as const,
          position: "relative" as const,
        }}
      >
        {active ? "✓ copied" : value}
      </td>
    );
  }

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <CardHeader eyebrow="Theoretical" eyebrowColor="var(--amber)" title="Optimal Sample"
        badge={<span className="chip chip-muted">{OPTIMAL.length} results</span>}
        actions={<><IconBtn icon="filter"/><IconBtn icon="download"/><IconBtn icon="refresh"/></>}
      />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["ID","R","Entry","Exit","Trade ID",""].map((h, i) => (
                <th key={i} style={{ ...TH, width: i === 5 ? 28 : undefined }}>
                  {/* copy hint on copyable columns */}
                  {[0,2,3,4].includes(i) && h
                    ? <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {h}
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4 }} aria-hidden>
                          <rect x="4" y="1" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                          <rect x="1" y="3" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" fill="var(--card)"/>
                        </svg>
                      </span>
                    : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OPTIMAL.map(t => {
              const sel = selected === t.id;
              const bg  = sel ? "rgba(77,156,245,0.06)" : hov === t.id ? "var(--raised)" : "transparent";
              return (
                <tr key={t.id}
                  onMouseEnter={() => setHov(t.id)}
                  onMouseLeave={() => setHov(null)}
                  onClick={() => onSelect(t.id)}
                  style={{ background: bg, cursor: "pointer", transition: "background 0.1s" }}
                >
                  <CopyTd id={t.id} field="id"      value={t.id}             baseStyle={{ color: "var(--ink-2)", fontSize: 11.5 }} />
                  <td style={{ ...TD, color: rColor(t.r), fontWeight: 600 }}>{rFmt(t.r)}</td>
                  <CopyTd id={t.id} field="entry"   value={t.entry}          baseStyle={{ fontSize: 11.5 }} />
                  <CopyTd id={t.id} field="exit"    value={t.exit}           baseStyle={{ fontSize: 11.5 }} />
                  <CopyTd id={t.id} field="tradeId" value={t.tradeId || "—"} baseStyle={{ color: t.tradeId ? "var(--blue)" : "var(--ink-3)", fontSize: 11.5 }} />
                  <td style={{ ...TD, padding: "9px 8px", width: 28 }}>
                    {sel && <button type="button" onClick={e => { e.stopPropagation(); onSelect(""); }} style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LIVE TRADE TABLE
═══════════════════════════════════════════════════════════ */
function LiveTable() {
  const COLS = ["ID","Entry","Exit","R","Entry Price","Dir","RM","Lock","Target","Is Bad"];
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <CardHeader eyebrow="Live" eyebrowColor="var(--red)" title="Trade"
        badge={<span className="chip chip-red"><span style={{ display:"inline-block", width:5, height:5, borderRadius:"50%", background:"var(--red)", marginRight:5, verticalAlign:"middle" }}/>LIVE</span>}
        right={<span className="chip chip-muted">0 results</span>}
        actions={<><IconBtn icon="filter"/><IconBtn icon="download"/><IconBtn icon="refresh"/></>}
      />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{COLS.map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody><tr><td colSpan={COLS.length} style={{ padding: "44px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>No active positions</td></tr></tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SESSION JOURNAL
═══════════════════════════════════════════════════════════ */
function JournalLog() {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <CardHeader title="Session Journal" />
      <div>
        {JOURNAL.map((j, i) => (
          <div key={i} style={{ padding: "13px 16px", borderBottom: i < JOURNAL.length - 1 ? "1px solid var(--line)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {j.tradeId && <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--blue)", background: "var(--blue-10)", padding: "2px 7px", borderRadius: 3 }}>{j.tradeId}</span>}
              <span style={{ fontSize: 10.5, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{j.time}</span>
              {j.analyst && <span className="chip chip-amber" style={{ fontSize: 9.5 }}>Analyst</span>}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: j.analyst ? "var(--ink-1)" : "var(--ink-2)", lineHeight: 1.7 }}>{j.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RECORD TRADE FORM
═══════════════════════════════════════════════════════════ */
function RecordTradeForm({ selectedId }: { selectedId: string | null }) {
  const pad   = (n: number) => String(n).padStart(2, "0");
  const dtNow = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const [tradeId, setTradeId] = useState("");
  const [entry,   setEntry]   = useState(dtNow);
  const [exit_,   setExit]    = useState(dtNow);
  const [exemptR, setExemptR] = useState("0");
  const [result,  setResult]  = useState("0");
  const [exemp,   setExemp]   = useState("false");
  const [done,    setDone]    = useState(false);

  useEffect(() => { if (selectedId) setTradeId(selectedId); }, [selectedId]);

  function submit(e: FormEvent) { e.preventDefault(); setDone(true); setTimeout(() => setDone(false), 2500); }

  const nowLabel = new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)" }}>Optimal Trade</span>
        <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{nowLabel}</span>
      </div>
      <form onSubmit={submit} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 11 }}>
        <div><label style={LBL}>Trade ID</label><input style={INP} placeholder="Enter value" value={tradeId} onChange={e => setTradeId(e.target.value)} /></div>
        <div>
          <label style={{ ...LBL, color: "var(--red)" }}>Entry *</label>
          <input
            type="datetime-local" style={INP} value={entry} required
            onChange={e => setEntry(e.target.value)}
            onPaste={e => {
              const parsed = parseFlexDatetime(e.clipboardData.getData("text"));
              if (parsed) { e.preventDefault(); setEntry(parsed); }
            }}
            title="Type or paste a date — e.g. Jun 26 · 12:15 PM"
          />
        </div>
        <div>
          <label style={{ ...LBL, color: "var(--red)" }}>Exit *</label>
          <input
            type="datetime-local" style={INP} value={exit_} required
            onChange={e => setExit(e.target.value)}
            onPaste={e => {
              const parsed = parseFlexDatetime(e.clipboardData.getData("text"));
              if (parsed) { e.preventDefault(); setExit(parsed); }
            }}
            title="Type or paste a date — e.g. Jun 26 · 12:15 PM"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={{ ...LBL, color: "var(--red)" }}>ExemptR *</label><input type="number" step="0.01" style={INP} value={exemptR} onChange={e => setExemptR(e.target.value)} required /></div>
          <div><label style={{ ...LBL, color: "var(--red)" }}>Result *</label><input type="number" step="0.01" style={INP} value={result} onChange={e => setResult(e.target.value)} required /></div>
        </div>
        <div><label style={{ ...LBL, color: "var(--red)" }}>Exemp # *</label>
          <select style={{ ...INP, cursor: "pointer" }} value={exemp} onChange={e => setExemp(e.target.value)}>
            <option value="false">False</option><option value="true">True</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "11px", fontSize: 12.5, marginTop: 2 }}>
          {done ? "✓ Recorded" : "Submit"}
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADD COMMENT FORM
═══════════════════════════════════════════════════════════ */
function AddCommentForm({ tradeId: initId, fullWidth, isAnalyst }: { tradeId?: string; fullWidth?: boolean; isAnalyst?: boolean }) {
  const pad     = (n: number) => String(n).padStart(2, "0");
  const dtNow   = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  const [content,   setContent]   = useState("");
  const [tradeId,   setTradeId]   = useState(initId ?? "");
  const [createdAt, setCreatedAt] = useState(dtNow);
  const [done,      setDone]      = useState(false);

  useEffect(() => { if (initId) setTradeId(initId); }, [initId]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    /* Analyst comments are automatically prefixed */
    const _final = isAnalyst ? `Analyst comment: ${content.trim()}` : content.trim();
    void _final; /* will be sent to DB when wired */
    setDone(true);
    setContent("");
    setTimeout(() => setDone(false), 2500);
  }

  const nowLabel = new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)" }}>Add Comment</span>
          {isAnalyst && (
            <span className="chip chip-amber" style={{ fontSize: 9.5 }}>Analyst</span>
          )}
        </div>
        <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{nowLabel}</span>
      </div>
      <form onSubmit={submit} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 11 }}>
        <div>
          <label style={{ ...LBL, color: "var(--red)" }}>Content *</label>

          {/* Analyst prefix badge — sits flush above the textarea */}
          {isAnalyst && (
            <div style={{
              padding: "5px 10px",
              background: "var(--amber-10)",
              border: "1px solid rgba(240,160,48,0.22)",
              borderBottom: "none",
              borderRadius: "4px 4px 0 0",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M6 1L7.5 4.5H11L8 7l1 3.5L6 8.5 3 10.5 4 7 1 4.5h3.5L6 1Z" stroke="var(--amber)" strokeWidth="1" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--amber)", letterSpacing: "0.03em" }}>
                Analyst comment:
              </span>
              <span style={{ fontSize: 10, color: "rgba(240,160,48,0.5)", fontStyle: "italic" }}>
                prepended automatically
              </span>
            </div>
          )}

          <textarea
            style={{
              ...INP,
              minHeight: fullWidth ? 160 : 96,
              resize: "vertical",
              ...(isAnalyst && { borderRadius: "0 0 4px 4px", borderTop: "1px solid rgba(240,160,48,0.22)" }),
            }}
            placeholder={isAnalyst ? "Your observation or analysis…" : "Enter your observation, decision, or emotional state…"}
            value={content}
            onChange={e => setContent(e.target.value)}
            required
          />
        </div>
        <div><label style={LBL}>Trade ID</label><input style={INP} placeholder="Link to specific trade (optional)" value={tradeId} onChange={e => setTradeId(e.target.value)} /></div>

        {/* Analyst-only: adjustable creation timestamp */}
        {isAnalyst && (
          <div>
            <label style={LBL}>Created At</label>
            <input
              type="datetime-local" style={INP} value={createdAt}
              onChange={e => setCreatedAt(e.target.value)}
              onPaste={e => {
                const parsed = parseFlexDatetime(e.clipboardData.getData("text"));
                if (parsed) { e.preventDefault(); setCreatedAt(parsed); }
              }}
            />
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={!content.trim()} style={{ width: "100%", padding: "11px", fontSize: 12.5 }}>
          {done ? "✓ Comment added" : "Submit"}
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SESSION COUNTDOWN
═══════════════════════════════════════════════════════════ */
function SessionCountdown() {
  const [status, setStatus] = useState<SessionStatus | null>(null);

  useEffect(() => {
    setStatus(getSessionStatus());
    const id = setInterval(() => setStatus(getSessionStatus()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const { inSession, sessionName, targetLabel, remainingSec } = status;
  const accent = inSession ? "var(--green)" : "var(--blue)";
  const bg     = inSession ? "var(--green-06)"  : "rgba(77,156,245,0.05)";
  const border = inSession ? "rgba(0,204,122,0.22)" : "rgba(77,156,245,0.18)";

  return (
    <div className="session-countdown-wrap" style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 20px", borderRadius: 6,
      background: bg, border: `1px solid ${border}`,
    }}>
      {/* Left — session info */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Status dot */}
        <div style={{
          width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
          background: accent,
          boxShadow: inSession ? `0 0 0 3px ${inSession ? "rgba(0,204,122,0.18)" : "rgba(77,156,245,0.15)"}` : "none",
        }} />

        <div>
          <p style={{ margin: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: accent, lineHeight: 1 }}>
            {inSession ? "Session Active" : "Standby"}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: "var(--ink-1)", lineHeight: 1 }}>
            {sessionName}
            <span style={{ fontWeight: 400, color: "var(--ink-3)", marginLeft: 8 }}>
              · {inSession ? "until" : "starts"} {targetLabel}
            </span>
          </p>
        </div>
      </div>

      {/* Right — countdown clock */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--ink-3)", lineHeight: 1 }}>
          {inSession ? "ends in" : "starts in"}
        </span>
        <span
          className="session-clock"
          style={{ color: accent, textShadow: inSession ? `0 0 20px ${accent}60` : "none" }}
        >
          {fmtHMS(remainingSec)}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FRICTION PANEL  —  Operator mode
   ─ Mirror + Friction Updates are the primary focus.
   ─ Metrics (State / Execution / Edge) are collapsed.
═══════════════════════════════════════════════════════════ */
function StatPill({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px", borderRadius: 4, background: "var(--sub)", border: "1px solid var(--line)" }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "var(--ink-3)" }}>{label}</span>
      <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", fontWeight: 700, color: accent ?? "var(--ink-1)" }}>{value}</span>
    </div>
  );
}

function MetricRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{label}</span>
      <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", fontWeight: 600, color: accent ?? "var(--ink-1)" }}>{value}</span>
    </div>
  );
}

function FrictionPanel({ f }: { f: FrictionReport }) {
  const [metricsOpen, setMetricsOpen] = useState(false);
  const ratingColor = ({ ELITE: "var(--green)", "ON-PAR": "var(--amber)", "SUB-PAR": "var(--red)" } as const)[f.exec.label] ?? "var(--ink-1)";

  /* section divider with label */
  const Divider = ({ label, color }: { label: string; color: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", color, textTransform: "uppercase" as const, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${color}40, transparent)` }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ───────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p className="section-eyebrow" style={{ color: "var(--amber)", marginBottom: 5 }}>Pre-Session Mirror</p>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--ink-0)", letterSpacing: "-0.02em" }}>
            {f.state.mode}
          </p>
        </div>
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>{f.ts}</span>
      </div>

      {/* ── Key stats strip ───────────────────────────── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <StatPill label="Rating"  value={`${f.exec.rating} · ${f.exec.label}`} accent={ratingColor} />
        <StatPill label="Leakage" value={`${f.exec.leakage}R`}                 accent="var(--red)" />
        <StatPill label="Forgiven" value={`+${f.exec.forgiven}R`}              accent="var(--green)" />
        <StatPill label="SQN"     value={`${f.edge.sqn} / ${f.edge.stressSqn} stress`} accent="var(--green)" />
        <StatPill label="Decay"   value={`${f.edge.decay} · ${f.edge.decayLabel}`}      accent="var(--red)" />
        <StatPill label="Capture" value={`${f.exec.capture}%`}                 accent="var(--green)" />
      </div>

      {/* ══════════════════════════════════════════════
          PRIMARY FOCUS #1 — THE MIRROR
      ══════════════════════════════════════════════ */}
      <div>
        <Divider label="The Mirror · LLM Audit" color="var(--amber)" />
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderLeft: "3px solid var(--amber)", borderRadius: "0 6px 6px 0", overflow: "hidden" }}>

          {/* Review body — large, readable */}
          <div className="mirror-body">
            <span className="chip chip-amber" style={{ marginBottom: 14, display: "inline-block" }}>Radical Candor</span>
            <p style={{ margin: 0, fontSize: 14.5, color: "var(--ink-0)", lineHeight: 1.85, letterSpacing: "0.005em" }}>
              {f.mirror}
            </p>
          </div>

          {/* Flaws */}
          {f.flaws.length > 0 && (
            <div style={{ padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              {f.flaws.map((fl, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 12px", background: "var(--red-10)", border: "1px solid rgba(240,58,87,0.15)", borderRadius: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
                    <path d="M8 2L14 13H2L8 2Z" stroke="var(--red)" strokeWidth="1.2" strokeLinejoin="round"/>
                    <path d="M8 6.5v2.5M8 11h.01" stroke="var(--red)" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 11.5, color: "var(--red)", fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>{fl}</span>
                </div>
              ))}
            </div>
          )}

          {/* Handover notes */}
          {f.handover && (
            <div className="mirror-handover" style={{ borderTop: "1px solid var(--line)" }}>
              <p style={{ margin: "0 0 6px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em", color: "var(--ink-3)", textTransform: "uppercase" }}>Handover Notes</p>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.75 }}>{f.handover}</p>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PRIMARY FOCUS #2 — FRICTION UPDATES
      ══════════════════════════════════════════════ */}
      <div>
        <Divider label="System Friction Updates" color="var(--red)" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {f.updates.map((u, i) => (
            <div key={i} style={{ display: "flex", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
              {/* Number badge */}
              <div style={{ width: 44, flexShrink: 0, background: "var(--sub)", borderRight: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--ink-3)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              {/* Rule text */}
              <div className="friction-rule-text">
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-0)", lineHeight: 1.75 }}>{u}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECONDARY — collapsible full metrics
      ══════════════════════════════════════════════ */}
      <button
        type="button"
        onClick={() => setMetricsOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "4px 0", color: "var(--ink-3)" }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden style={{ transition: "transform 0.2s", transform: metricsOpen ? "rotate(180deg)" : "none" }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "var(--ink-3)" }}>
          {metricsOpen ? "Hide" : "Show"} full metrics
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </button>

      {metricsOpen && (
        <div className="grid-3-col" style={{ marginTop: -10 }}>
          {/* System State */}
          <div className="card" style={{ padding: "12px 14px" }}>
            <span className="chip chip-amber" style={{ marginBottom: 10, display: "inline-block", fontSize: 9 }}>System State</span>
            <MetricRow label="Streak"     value={f.state.streak} />
            <MetricRow label="Injection"  value={f.state.injection} accent={f.state.locked ? "var(--red)" : "var(--green)"} />
            <MetricRow label="Status"     value={f.state.locked ? "LOCKED" : "UNLOCKED"} accent={f.state.locked ? "var(--red)" : "var(--green)"} />
            <MetricRow label="Scaling"    value={f.state.scaling} />
            <MetricRow label="Deployment" value={f.state.deployment} />
            {f.state.streakNote && <p style={{ marginTop: 8, fontSize: 10.5, color: "var(--ink-3)", fontStyle: "italic", lineHeight: 1.5 }}>{f.state.streakNote}</p>}
          </div>
          {/* Execution Truth */}
          <div className="card" style={{ padding: "12px 14px" }}>
            <span className="chip chip-blue" style={{ marginBottom: 10, display: "inline-block", fontSize: 9 }}>Execution</span>
            <MetricRow label="Rating"      value={String(f.exec.rating)} accent={ratingColor} />
            <MetricRow label="Leakage"     value={`${f.exec.leakage}R`}  accent="var(--red)" />
            <MetricRow label="Forgiven"    value={`+${f.exec.forgiven}R`} accent="var(--green)" />
            <MetricRow label="Lucky R"     value={`${f.exec.luckyR}R`}   accent="var(--ink-2)" />
            <MetricRow label="Capture"     value={`${f.exec.capture}%`}  accent="var(--green)" />
            <MetricRow label="Exemptions"  value={String(f.exec.exemptions)} accent="var(--amber)" />
          </div>
          {/* Probabilistic Edge */}
          <div className="card" style={{ padding: "12px 14px" }}>
            <span className="chip chip-green" style={{ marginBottom: 10, display: "inline-block", fontSize: 9 }}>Probabilistic Edge</span>
            <MetricRow label="System SQN"  value={String(f.edge.sqn)}       accent="var(--green)" />
            <MetricRow label="Stress SQN"  value={String(f.edge.stressSqn)} accent="var(--green)" />
            <MetricRow label="Edge Decay"  value={String(f.edge.decay)}      accent="var(--red)" />
            <MetricRow label="Decay Label" value={f.edge.decayLabel}         accent="var(--red)" />
            <MetricRow label="Target Risk" value={f.edge.risk}               accent="var(--ink-1)" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════ */
export default function SessionClient({ user }: { user: User }) {
  const [mode,         setMode]         = useState<Mode>("operator");
  const [modeOverride, setModeOverride] = useState<Mode | null>(null);
  const [greeting,     setGreeting]     = useState("Welcome back");
  const [timeStr,      setTimeStr]      = useState("");
  const [dayStr,       setDayStr]       = useState("");
  const [selId,        setSelId]        = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      const m = melbNow();
      setMode(m.mode);
      setGreeting(getGreeting(user.name, m.hour));
      setTimeStr(m.timeStr);
      setDayStr(m.dayStr);
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [user.name]);

  /* In dev: override supersedes the time gate */
  const effectiveMode = IS_DEV && modeOverride !== null ? modeOverride : mode;

  const selectedTradeId = selId ? (OPTIMAL.find(t => t.id === selId)?.tradeId || selId) : undefined;
  const modeColor = effectiveMode === "analyst" ? "var(--amber)" : "var(--green)";

  return (
    <div style={{ minHeight: "100%", paddingBottom: 64 }}>
      <div className="site-container" style={{ paddingTop: 32 }}>

        {/* ── PAGE HEADER ──────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: modeColor, boxShadow: `0 0 8px ${modeColor}` }} />
              <span className="section-eyebrow" style={{ color: modeColor }}>
                {effectiveMode === "analyst" ? "Analyst Mode" : "Operator Mode"}
              </span>
              {IS_DEV && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
                  <button
                    type="button"
                    onClick={() => setModeOverride(effectiveMode === "analyst" ? "operator" : "analyst")}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "3px 8px", borderRadius: 3,
                      background: "var(--amber-10)", border: "1px solid rgba(240,160,48,0.28)",
                      cursor: "pointer", fontSize: 10, fontWeight: 700,
                      color: "var(--amber)", letterSpacing: "0.06em",
                      textTransform: "uppercase" as const,
                    }}
                  >
                    <span style={{ opacity: 0.6, fontSize: 9 }}>DEV</span>
                    <span>→ {effectiveMode === "analyst" ? "Operator" : "Analyst"}</span>
                  </button>
                  {modeOverride !== null && (
                    <button
                      type="button"
                      onClick={() => setModeOverride(null)}
                      title="Reset to time-based mode"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 13, lineHeight: 1, padding: "0 2px" }}
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink-0)" }}>{greeting}</h1>
            {timeStr && <p style={{ marginTop: 5, fontSize: 11.5, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>Melbourne · {dayStr} · {timeStr} AEST</p>}
          </div>
          <div className="session-header-tasks">
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase" }}>Session Tasks</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TASKS.map(t => <TaskPill key={t.id} done={t.done} label={t.label} ts={t.ts} />)}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--line)", marginBottom: 20 }} />

        {/* ── SESSION COUNTDOWN ────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <SessionCountdown />
        </div>

        {/* ════════════════════════════════════════════════════
            ANALYST MODE
        ════════════════════════════════════════════════════ */}
        {effectiveMode === "analyst" && (
          <div className="session-2col">
            <div className="session-main">
              <OptimalTable selected={selId} onSelect={id => setSelId(prev => prev === id ? null : id)} />
              <LiveTable />
              <JournalLog />
            </div>
            <div className="session-sidebar">
              <RecordTradeForm selectedId={selId} />
              <AddCommentForm tradeId={selectedTradeId} isAnalyst />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            OPERATOR MODE
        ════════════════════════════════════════════════════ */}
        {effectiveMode === "operator" && (
          <div className="session-2col">
            <div style={{ flex: 1, minWidth: 0 }}>
              <FrictionPanel f={FRICTION} />
            </div>
            <div className="session-sidebar session-sidebar-340">
              <AddCommentForm fullWidth />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
