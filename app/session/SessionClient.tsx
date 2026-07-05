"use client";

import React, { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import { getMondayAESTKey } from "@/lib/weekKey";
import { getSessionStatus } from "@/lib/sessionStatus";

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

/* ═══════════════════════════════════════════════════════════
   DB ROW TYPES
═══════════════════════════════════════════════════════════ */
interface OptimalRow {
  optimal_trade_id: string;
  trade_id:         string | null;
  result_r:         number;
  entry:            string;
  exit:             string;
  created_at:       string;
}

interface LiveRow {
  trade_id:    string;
  entry:       string;
  exit:        string;
  cor_dir:     boolean | null;
  cor_lock:    boolean | null;
  cor_target:  boolean | null;
  cor_entry:   boolean | null;
  cor_rm:      boolean | null;
  is_bad:      boolean | null;
  manual_pass: boolean | null;
  result_r:    number;
  [key: string]: unknown;
}

interface CommentRow {
  id?:        string;
  trade_id:   string | null;
  content:    string;
  Entry:      string;
  created_at: string;
}

/* ═══════════════════════════════════════════════════════════
   TOAST NOTIFICATION
═══════════════════════════════════════════════════════════ */
type ToastMsg = { id: number; kind: "success" | "error"; text: string };
type ShowToast = (kind: ToastMsg["kind"], text: string) => void;

function Toaster({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <>
      <style>{`
        @keyframes _toast-in {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        ._toast { animation: _toast-in 0.2s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>
      <div style={{
        position: "fixed", bottom: 32, right: 32, zIndex: 99999,
        display: "flex", flexDirection: "column", gap: 10,
        pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <div key={t.id} className="_toast" style={{
            display: "flex", alignItems: "flex-start", gap: 11,
            padding: "14px 18px", borderRadius: 10,
            /* solid opaque backgrounds so they're visible on any bg */
            background: t.kind === "success" ? "#0d2e1f" : "#2e0d10",
            border: `1px solid ${t.kind === "success" ? "#00cc7a55" : "#f03a5755"}`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)",
            minWidth: 240, maxWidth: 360,
          }}>
            {t.kind === "success"
              ? <svg width="17" height="17" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="7" stroke="#00cc7a" strokeWidth="1.4"/><path d="M5 8l2.2 2.2L11 5.5" stroke="#00cc7a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="17" height="17" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="7" stroke="#f03a57" strokeWidth="1.4"/><path d="M8 5v3.5M8 10.5h.01" stroke="#f03a57" strokeWidth="1.6" strokeLinecap="round"/></svg>
            }
            <span style={{
              fontSize: 13, fontWeight: 600, lineHeight: 1.5,
              color: t.kind === "success" ? "#00cc7a" : "#f03a57",
            }}>{t.text}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function rFmt(r: number)   { return r.toFixed(4) + "R"; }
function rColor(r: number) {
  if (Math.abs(r) <= 0.08) return "var(--ink-3)";
  return r > 0 ? "var(--green)" : "var(--red)";
}

/*
  Trading sessions (Melbourne local time):
    Session 1 — 18:00 → 19:00
    Session 2 — 20:00 → 01:00 (next day)
*/
/* SessionStatus + getSessionStatus are shared — imported from lib/sessionStatus */
type SessionStatus = import("@/lib/sessionStatus").SessionStatus;

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

function isContractActive(c: { type: "day" | "week"; setAt: string }): boolean {
  const aestNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const aestSet = new Date(new Date(c.setAt).toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  if (c.type === "day") return aestNow.toDateString() === aestSet.toDateString();
  const monday = (d: Date) => {
    const dow = d.getDay();
    const r   = new Date(d);
    r.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    r.setHours(0, 0, 0, 0);
    return r.getTime();
  };
  return monday(aestNow) === monday(aestSet);
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
function TaskPill({ done, label, ts, onClick, loading }: {
  done: boolean; label: string; ts: string | null;
  onClick?: () => void; loading?: boolean;
}) {
  const clickable = !!onClick && !done && !loading;
  return (
    <div
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      title={clickable ? `Click to verify ${label}` : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 7, padding: "5px 10px", borderRadius: 4,
        border: `1px solid ${done ? "rgba(0,204,122,0.22)" : "var(--line)"}`,
        background: done ? "var(--green-06)" : "var(--sub)",
        cursor: clickable ? "pointer" : "default",
        transition: "border-color 0.15s, background 0.15s",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden style={{ animation: "spin 1s linear infinite" }}>
          <circle cx="6" cy="6" r="4.5" stroke="var(--ink-3)" strokeWidth="1.5" strokeDasharray="14 8"/>
        </svg>
      ) : done ? (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <circle cx="6" cy="6" r="5.5" stroke="var(--green)" strokeWidth="1"/>
          <path d="M3.5 6l1.8 1.8 3-3.6" stroke="var(--green)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid var(--ink-3)", flexShrink: 0 }} />
      )}
      <span style={{ fontSize: 11, fontWeight: 600, color: done ? "var(--green)" : "var(--ink-2)", letterSpacing: "0.02em" }}>{label}</span>
      {loading              && <span style={{ fontSize: 10, color: "var(--ink-3)", fontStyle: "italic" }}>checking…</span>}
      {!loading && done && ts && <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{ts}</span>}
      {!loading && done && !ts && <span style={{ fontSize: 10, color: "var(--green)", fontStyle: "italic" }}>verified</span>}
      {!loading && !done        && <span style={{ fontSize: 10, color: "var(--ink-3)", fontStyle: "italic" }}>{clickable ? "click to verify" : "pending"}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px 10px", padding: "13px 16px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
        {eyebrow && <span className="section-eyebrow" style={{ color: eyebrowColor ?? "var(--green)" }}>{eyebrow}</span>}
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)", letterSpacing: "-0.01em" }}>{title}</span>
        {badge}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{right}{actions}</div>
    </div>
  );
}

function IconBtn({ icon, onClick }: { icon: "filter" | "download" | "refresh"; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "var(--ink-3)", display: "flex", alignItems: "center" }}>
      {icon === "filter"   && <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 8h6M7 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>}
      {icon === "download" && <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      {icon === "refresh"  && <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M13 8A5 5 0 1 1 8 3h3.5M11.5 3v3.5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   OPTIMAL TRADE TABLE
═══════════════════════════════════════════════════════════ */
function tzOffset(tz: string): string {
  try {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return p.find(x => x.type === "timeZoneName")?.value ?? "";
  } catch { return ""; }
}

const TIMEZONES = [
  { label: "Melbourne (AEST/AEDT)", value: "Australia/Melbourne" },
  { label: "Sydney   (AEST/AEDT)", value: "Australia/Sydney"    },
  { label: "UTC",                   value: "UTC"                 },
  { label: "London   (GMT/BST)",    value: "Europe/London"       },
  { label: "New York (EST/EDT)",    value: "America/New_York"    },
  { label: "Chicago  (CST/CDT)",    value: "America/Chicago"     },
  { label: "LA       (PST/PDT)",    value: "America/Los_Angeles" },
  { label: "Tokyo    (JST)",        value: "Asia/Tokyo"          },
  { label: "Singapore(SGT)",        value: "Asia/Singapore"      },
  { label: "Dubai    (GST)",        value: "Asia/Dubai"          },
  { label: "Frankfurt(CET/CEST)",   value: "Europe/Berlin"       },
];

/* Format a UTC ISO string for display in an arbitrary timezone */
function fmtTz(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      timeZone: tz, day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return iso; }
}

/* Current time as "YYYY-MM-DDTHH:MM" in the given timezone (for datetime-local inputs) */
function nowInTZ(tz: string): string {
  const now  = new Date();
  const ptz  = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p    = ptz.formatToParts(now);
  const get  = (t: string) => p.find(x => x.type === t)?.value ?? "00";
  const hr   = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hr}:${get("minute")}`;
}

/* Convert a UTC ISO string to a datetime-local value (YYYY-MM-DDTHH:mm) in the given timezone */
function utcToLocalInput(utcIso: string, tz: string): string {
  const d   = new Date(utcIso);
  const ptz = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p   = ptz.formatToParts(d);
  const get = (t: string) => p.find(x => x.type === t)?.value ?? "00";
  const hr  = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hr}:${get("minute")}`;
}

/* Convert a datetime-local string (treated as local time in `tz`) to UTC ISO */
function tzLocalToUTC(localStr: string, tz: string): string {
  const nums = localStr.split(/[-T:]/).map(Number);
  const [yr, mo, dy, hr = 0, mn = 0] = nums;

  const getOffset = (d: Date): number => {
    const ptz = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric", hour12: false,
    }).formatToParts(d);
    const g   = (t: string) => Number(ptz.find(x => x.type === t)?.value ?? 0);
    const h   = g("hour") % 24;
    return Date.UTC(g("year"), g("month") - 1, g("day"), h, g("minute"), g("second")) - d.getTime();
  };

  let d    = new Date(Date.UTC(yr, mo - 1, dy, hr, mn));
  const o1 = getOffset(d);
  d        = new Date(Date.UTC(yr, mo - 1, dy, hr, mn) - o1);
  const o2 = getOffset(d);
  if (o1 !== o2) d = new Date(Date.UTC(yr, mo - 1, dy, hr, mn) - o2);
  return d.toISOString();
}


type SortCol = "id" | "r" | "entry" | "exit" | "tradeid" | null;
type FilterResult = "all" | "win" | "loss" | "be";
type FilterLinked = "all" | "linked" | "unlinked";

function OptimalTable({ rows, loading, selected, onSelect, tz, onDelete, onRefresh }: {
  rows: OptimalRow[]; loading: boolean; selected: string | null;
  onSelect: (id: string) => void; tz: string;
  onDelete: (id: string) => Promise<void>; onRefresh?: () => void;
}) {
  const [hov,          setHov]          = useState<string | null>(null);
  const [copiedKey,    setCopiedKey]    = useState<string | null>(null);
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [showFilter,   setShowFilter]   = useState(false);
  const [filterResult, setFilterResult] = useState<FilterResult>("all");
  const [filterLinked, setFilterLinked] = useState<FilterLinked>("all");
  const [sortCol,      setSortCol]      = useState<SortCol>(null);
  const [sortDir,      setSortDir]      = useState<"asc" | "desc">("asc");

  const filtersActive = filterResult !== "all" || filterLinked !== "all";

  function toggleSort(col: NonNullable<SortCol>) {
    if (sortCol === col) {
      if (sortDir === "asc") { setSortDir("desc"); }
      else { setSortCol(null); setSortDir("asc"); }
    } else {
      setSortCol(col); setSortDir("asc");
    }
  }

  function SortIcon({ col }: { col: NonNullable<SortCol> }) {
    const active = sortCol === col;
    return (
      <svg width="8" height="11" viewBox="0 0 8 11" fill="none" style={{ flexShrink: 0, marginLeft: 3 }}>
        <path d="M4 1L6.5 4H1.5L4 1Z" fill={active && sortDir === "asc" ? "currentColor" : "var(--ink-3)"} opacity={active && sortDir === "asc" ? 1 : 0.4}/>
        <path d="M4 10L1.5 7H6.5L4 10Z" fill={active && sortDir === "desc" ? "currentColor" : "var(--ink-3)"} opacity={active && sortDir === "desc" ? 1 : 0.4}/>
      </svg>
    );
  }

  const filteredRows = rows.filter(t => {
    const be = Math.abs(t.result_r) <= 0.08;
    if (filterResult === "win"  && (be || t.result_r <= 0)) return false;
    if (filterResult === "loss" && (be || t.result_r >= 0)) return false;
    if (filterResult === "be"   && !be)                     return false;
    if (filterLinked === "linked"   && !t.trade_id)  return false;
    if (filterLinked === "unlinked" && !!t.trade_id) return false;
    return true;
  });

  const displayRows = sortCol ? [...filteredRows].sort((a, b) => {
    let va: string | number = 0, vb: string | number = 0;
    if      (sortCol === "r")       { va = a.result_r;                    vb = b.result_r; }
    else if (sortCol === "entry")   { va = new Date(a.entry).getTime();   vb = new Date(b.entry).getTime(); }
    else if (sortCol === "exit")    { va = new Date(a.exit).getTime();    vb = new Date(b.exit).getTime(); }
    else if (sortCol === "tradeid") { va = a.trade_id ?? "";              vb = b.trade_id ?? ""; }
    else                            { va = a.optimal_trade_id;            vb = b.optimal_trade_id; }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  }) : filteredRows;

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

  async function confirmDelete() {
    if (!confirmId) return;
    setDeleting(true);
    await onDelete(confirmId);
    setDeleting(false);
    setConfirmId(null);
  }

  const confirmRow = confirmId ? rows.find(r => r.optimal_trade_id === confirmId) : null;

  return (
    <div className="card" style={{ position: "relative" }}>
      {/* ── Delete confirmation overlay ── */}
      {confirmId && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: "rgba(4,8,15,0.82)", borderRadius: 6,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 20, padding: 28,
        }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", fontSize: 13.5, fontWeight: 600, color: "var(--ink-0)" }}>Delete trade?</p>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
              {confirmRow ? `${rFmt(confirmRow.result_r)}  ·  ${fmtTz(confirmRow.entry, tz)}` : confirmId.slice(0, 18) + "…"}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "var(--red)" }}>
              This also removes linked exempts. Cannot be undone.
            </p>
          </div>
          <div style={{
            background: "var(--card)", border: "1px solid var(--line-hi)", borderRadius: 7,
            padding: "14px 20px", display: "flex", gap: 10, justifyContent: "center",
            width: "100%", maxWidth: 280,
          }}>
            <button type="button" onClick={() => setConfirmId(null)} disabled={deleting}
              style={{ flex: 1, padding: "9px 0", borderRadius: 5, background: "var(--sub)", border: "1px solid var(--line-hi)", color: "var(--ink-1)", fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>
              Cancel
            </button>
            <button type="button" onClick={confirmDelete} disabled={deleting}
              style={{ flex: 1, padding: "9px 0", borderRadius: 5, background: deleting ? "rgba(240,58,87,0.5)" : "var(--sub)", border: "1px solid rgba(240,58,87,0.6)", color: "var(--red)", fontSize: 12.5, cursor: deleting ? "default" : "pointer", fontWeight: 700 }}>
              {deleting ? "Deleting…" : "Yes, proceed"}
            </button>
          </div>
        </div>
      )}

      <CardHeader eyebrow="Theoretical" eyebrowColor="var(--amber)" title="Optimal Sample"
        badge={
          <span className="chip chip-muted">
            {filtersActive ? `${displayRows.length} / ${rows.length}` : `${rows.length}`} results
          </span>
        }
        actions={<>
          <IconBtn icon="filter" onClick={() => setShowFilter(o => !o)} />
          <IconBtn icon="refresh" onClick={onRefresh} />
        </>}
      />

      {/* ── Filter bar ── */}
      {showFilter && (
        <div style={{ padding: "8px 16px 10px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", color: "var(--ink-3)", textTransform: "uppercase" as const, marginRight: 2 }}>Result</span>
          {(["all","win","loss","be"] as FilterResult[]).map(v => {
            const active = filterResult === v;
            return (
              <button key={v} type="button" onClick={() => setFilterResult(v)} style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 3, cursor: "pointer",
                background: active ? "rgba(77,156,245,0.14)" : "var(--sub)",
                border: `1px solid ${active ? "rgba(77,156,245,0.4)" : "var(--line)"}`,
                color: active ? "#4d9cf5" : "var(--ink-2)", fontWeight: active ? 700 : 400,
              }}>
                {v === "all" ? "All" : v === "win" ? "Win" : v === "loss" ? "Loss" : "B/E"}
              </button>
            );
          })}
          <span style={{ color: "var(--line-hi)", fontSize: 10, margin: "0 2px" }}>·</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", color: "var(--ink-3)", textTransform: "uppercase" as const, marginRight: 2 }}>Link</span>
          {(["all","linked","unlinked"] as FilterLinked[]).map(v => {
            const active = filterLinked === v;
            return (
              <button key={v} type="button" onClick={() => setFilterLinked(v)} style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 3, cursor: "pointer",
                background: active ? "rgba(77,156,245,0.14)" : "var(--sub)",
                border: `1px solid ${active ? "rgba(77,156,245,0.4)" : "var(--line)"}`,
                color: active ? "#4d9cf5" : "var(--ink-2)", fontWeight: active ? 700 : 400,
              }}>
                {v === "all" ? "All" : v === "linked" ? "Linked" : "Unlinked"}
              </button>
            );
          })}
          {filtersActive && (
            <button type="button" onClick={() => { setFilterResult("all"); setFilterLinked("all"); }}
              style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>
              Clear
            </button>
          )}
        </div>
      )}

      <HorizScrollContainer style={{ width: "100%" }} innerStyle={{ overflowY: "auto", maxHeight: 420, overscrollBehavior: "contain" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480, userSelect: "none" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--card)" }}>
            <tr>
              {([
                { label: "ID",       col: "id"      as SortCol },
                { label: "R",        col: "r"       as SortCol },
                { label: "Entry",    col: "entry"   as SortCol },
                { label: "Exit",     col: "exit"    as SortCol },
                { label: "Trade ID", col: "tradeid" as SortCol },
                { label: "",         col: null },
              ] as { label: string; col: SortCol }[]).map(({ label, col }, i) => (
                <th key={i} style={{ ...TH, width: i === 5 ? 28 : undefined, cursor: col ? "pointer" : "default", userSelect: "none" as const }}
                  onClick={col ? () => toggleSort(col as NonNullable<SortCol>) : undefined}>
                  {label ? (
                    <span style={{ display: "flex", alignItems: "center" }}>
                      {label}
                      {col && <SortIcon col={col as NonNullable<SortCol>} />}
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: "44px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>Loading…</td></tr>}
            {!loading && displayRows.length === 0 && <tr><td colSpan={6} style={{ padding: "44px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>{rows.length === 0 ? "No records" : "No matches"}</td></tr>}
            {!loading && displayRows.map(t => {
              const id  = t.optimal_trade_id;
              const sel = selected === id;
              const bg  = sel ? "rgba(77,156,245,0.06)" : hov === id ? "var(--raised)" : "transparent";
              return (
                <tr key={id}
                  onMouseEnter={() => setHov(id)}
                  onMouseLeave={() => setHov(null)}
                  onClick={() => onSelect(id)}
                  style={{ background: bg, cursor: "pointer", transition: "background 0.1s" }}
                >
                  {/* ID cell — fixed padding always 22px so column never shifts;
                      × is position:absolute and excluded from layout */}
                  <td
                    onClick={e => { copy(`${id}-id`, id, e); }}
                    title="Click to copy ID"
                    style={{
                      ...TD, color: copiedKey === `${id}-id` ? "var(--green)" : "var(--ink-2)",
                      fontSize: 11.5, cursor: "copy", userSelect: "none",
                      position: "relative", transition: "color 0.15s",
                      paddingLeft: 22,
                    }}
                  >
                    <button type="button"
                      onClick={e => { e.stopPropagation(); setConfirmId(id); }}
                      title="Delete trade"
                      style={{
                        position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", color: "var(--red)",
                        cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0,
                        opacity: hov === id ? 1 : 0,
                        pointerEvents: hov === id ? "auto" : "none",
                        transition: "opacity 0.12s",
                      }}>
                      ×
                    </button>
                    {copiedKey === `${id}-id` ? "✓ copied" : id.slice(0,13)+"…"}
                  </td>
                  <td style={{ ...TD, color: rColor(t.result_r), fontWeight: 600 }}>{rFmt(t.result_r)}</td>
                  <CopyTd id={id} field="entry"   value={fmtTz(t.entry, tz)}    baseStyle={{ fontSize: 11.5 }} />
                  <CopyTd id={id} field="exit"    value={fmtTz(t.exit, tz)}     baseStyle={{ fontSize: 11.5 }} />
                  <CopyTd id={id} field="tradeId" value={t.trade_id ?? "—"}     baseStyle={{ color: t.trade_id ? "var(--blue)" : "var(--ink-3)", fontSize: 11.5 }} />
                  <td style={{ ...TD, padding: "9px 8px", width: 28 }}>
                    {sel && <button type="button" onClick={e => { e.stopPropagation(); onSelect(""); }} style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </HorizScrollContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LIVE TRADE TABLE
═══════════════════════════════════════════════════════════ */
type LiveBoolDraft = boolean | null;
type LiveDraftFields = { cor_dir: LiveBoolDraft; cor_lock: LiveBoolDraft; cor_target: LiveBoolDraft; cor_entry: LiveBoolDraft; cor_rm: LiveBoolDraft; is_bad: LiveBoolDraft };
type LiveDrafts = Record<string, Partial<LiveDraftFields>>; // keyed by trade_id

const BOOL_FIELDS: (keyof LiveDraftFields)[] = ["cor_dir", "cor_lock", "cor_target", "cor_entry", "cor_rm", "is_bad"];
/* The 5 cor_* fields that define whether a trade is "processed" (matches pipeline API) */
const COR_FIELDS = ["cor_dir", "cor_lock", "cor_target", "cor_entry", "cor_rm"] as const;
const isTradeProcessed = (r: LiveRow) => COR_FIELDS.every(f => r[f] !== null);

function BoolSelect({ value, changed, onChange, invert = false }: {
  value: boolean | null; changed: boolean; onChange: (v: boolean | null) => void; invert?: boolean;
}) {
  const sel = value === null ? "" : value ? "true" : "false";
  return (
    <select
      value={sel}
      onChange={e => onChange(e.target.value === "" ? null : e.target.value === "true")}
      style={{
        minWidth: 64,
        background: changed ? "rgba(240,160,48,0.08)" : "var(--sub)",
        border: `1px solid ${changed ? "rgba(240,160,48,0.55)" : "var(--line)"}`,
        borderRadius: 3, color: "var(--ink-1)",
        fontSize: 11, fontFamily: "var(--font-mono)",
        padding: "3px 5px", outline: "none", cursor: "pointer",
        boxShadow: changed ? "0 0 0 2px rgba(240,160,48,0.12)" : "none",
      }}
    >
      <option value="">—</option>
      {invert ? (
        <>
          <option value="true">✗ Toxic</option>
          <option value="false">✓ OK</option>
        </>
      ) : (
        <>
          <option value="true">✓ Pass</option>
          <option value="false">✗ Fail</option>
        </>
      )}
    </select>
  );
}

/* Custom horizontal scroll container with a large draggable thumb overlay.
   - Hides the native scrollbar
   - Shows a thick thumb on hover / while dragging
   - Wheel (deltaX or Shift+deltaY) still scrolls the content               */
function HorizScrollContainer({
  children, style, innerStyle,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  innerStyle?: React.CSSProperties;
}) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const [thumbLeft,  setThumbLeft]  = useState(0);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [hovered,    setHovered]    = useState(false);
  const [dragging,   setDragging]   = useState(false);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    if (scrollWidth <= clientWidth) { setThumbWidth(0); return; }
    const ratio = clientWidth / scrollWidth;
    const w     = Math.max(48, clientWidth * ratio);
    const max   = clientWidth - w;
    setThumbWidth(w);
    setThumbLeft(scrollWidth > clientWidth ? (scrollLeft / (scrollWidth - clientWidth)) * max : 0);
  }, []);

  /* Wheel handler */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const dx = e.deltaX !== 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (dx === 0) return;
      e.preventDefault();
      e.stopPropagation();
      el.scrollLeft += dx;
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  /* Sync thumb on scroll + resize */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateThumb, { passive: true });
    updateThumb();
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateThumb); ro.disconnect(); };
  }, [updateThumb]);

  /* Drag */
  const onThumbDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { x: e.clientX, scrollLeft: scrollRef.current?.scrollLeft ?? 0 };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      const { scrollWidth, clientWidth } = el;
      const trackW   = clientWidth;
      const thumbW   = Math.max(48, clientWidth * (clientWidth / scrollWidth));
      const maxThumb = trackW - thumbW;
      const maxScroll = scrollWidth - clientWidth;
      const dx = e.clientX - dragStart.current.x;
      el.scrollLeft = Math.max(0, Math.min(maxScroll, dragStart.current.scrollLeft + (dx / maxThumb) * maxScroll));
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  const showBar = (hovered || dragging) && thumbWidth > 0;

  return (
    <div style={{ position: "relative", ...style }}>
      {/* Content — native scrollbar hidden */}
      <div ref={scrollRef} className="table-hscroll-inner" style={{
        overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
        ...innerStyle,
      }}>
        {children}
      </div>

      {/* Custom scrollbar track — always in DOM so hover target exists; thumb fades in */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => !dragging && setHovered(false)}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 19,
          pointerEvents: thumbWidth > 0 ? "auto" : "none",
          background: "rgba(255,255,255,0.03)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div
          onMouseDown={onThumbDown}
          style={{
            position: "absolute",
            left: thumbLeft,
            width: thumbWidth,
            top: 3, bottom: 3,
            opacity: showBar ? 1 : 0,
            transition: dragging ? "none" : "opacity 0.18s, background 0.15s",
            background: dragging ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)",
            borderRadius: 5,
            cursor: dragging ? "grabbing" : "grab",
            userSelect: "none",
          }}
        />
      </div>
    </div>
  );
}

function BoolBadge({ value, invert = false }: { value: boolean | null; invert?: boolean }) {
  if (value === null) return <span style={{ color: "var(--ink-3)", fontWeight: 700, fontSize: 11 }}>—</span>;
  const pass = invert ? !value : value;
  return pass
    ? <span style={{ color: "var(--green)", fontSize: 11 }}>✓</span>
    : <span style={{ color: "var(--red)",   fontSize: 11 }}>✗</span>;
}

type LiveSortKey = "trade_id" | "entry" | "exit" | "result_r" | "cor_dir" | "cor_lock" | "cor_target" | "cor_rm" | "cor_entry" | "is_bad" | "status";

const LIVE_COLS: { label: string; key: LiveSortKey }[] = [
  { label: "ID",        key: "trade_id"   },
  { label: "Entry",     key: "entry"      },
  { label: "Exit",      key: "exit"       },
  { label: "R",         key: "result_r"   },
  { label: "Dir",       key: "cor_dir"    },
  { label: "Lock",      key: "cor_lock"   },
  { label: "Target",    key: "cor_target" },
  { label: "RM",        key: "cor_rm"     },
  { label: "Cor. Entry",key: "cor_entry"  },
  { label: "Bad",       key: "is_bad"     },
  { label: "Status",    key: "status"     },
];

function sortLiveRows(
  rows: LiveRow[],
  key: LiveSortKey,
  dir: 1 | -1,
  isIncomplete: (r: LiveRow) => boolean,
): LiveRow[] {
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (key === "trade_id") {
      cmp = a.trade_id.localeCompare(b.trade_id);
    } else if (key === "entry" || key === "exit") {
      cmp = new Date(a[key]).getTime() - new Date(b[key]).getTime();
    } else if (key === "result_r") {
      cmp = (a.result_r ?? 0) - (b.result_r ?? 0);
    } else if (key === "is_bad") {
      const rank = (v: boolean | null) => v === null ? 0 : v ? 2 : 1;
      cmp = rank(a.is_bad) - rank(b.is_bad);
    } else if (key === "status") {
      cmp = (isIncomplete(a) ? 1 : 0) - (isIncomplete(b) ? 1 : 0);
    } else {
      const av = a[key] as boolean | null;
      const bv = b[key] as boolean | null;
      const rank = (v: boolean | null) => v === null ? 0 : v ? 2 : 1;
      cmp = rank(av) - rank(bv);
    }
    return cmp * dir;
  });
}

function CopyCell({ value, display, style }: { value: string; display?: React.ReactNode; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  const handleClick = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <span
      onClick={handleClick}
      title={`Click to copy: ${value}`}
      style={{
        cursor: "copy",
        borderRadius: 3,
        padding: "1px 3px",
        background: copied ? "rgba(0,204,122,0.12)" : "transparent",
        color: copied ? "var(--green)" : "inherit",
        transition: "background 0.2s, color 0.2s",
        userSelect: "none",
        ...style,
      }}
    >
      {copied ? "Copied!" : (display ?? value)}
    </span>
  );
}

function SortChevron({ active, dir }: { active: boolean; dir: 1 | -1 }) {
  return (
    <svg
      width="8" height="8" viewBox="0 0 8 8" fill="none"
      style={{ marginLeft: 3, opacity: active ? 1 : 0.25, flexShrink: 0 }}
    >
      {dir === 1
        ? <path d="M4 6L1 2h6L4 6z" fill="currentColor"/>
        : <path d="M4 2l3 4H1L4 2z" fill="currentColor"/>}
    </svg>
  );
}

const WEEK_OPTIONS = [1, 2, 3, 4] as const;

function LiveTable({ tz, isAnalyst, onRefresh, onHydrate }: {
  tz: string; isAnalyst?: boolean; onRefresh?: () => void; onHydrate?: (v: TradeHydrate) => void;
}) {
  const [rows,       setRows]       = useState<LiveRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [weeks,      setWeeks]      = useState(1);
  const [drafts,     setDrafts]     = useState<LiveDrafts>({});
  const [submitting, setSubmitting] = useState(false);
  const [sortKey,    setSortKey]    = useState<LiveSortKey>("entry");
  const [sortDir,    setSortDir]    = useState<1 | -1>(-1);
  const [liveFilter, setLiveFilter] = useState<"queue" | "all" | "processed">("queue");

  const fetchRows = useCallback(async (w: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/session/live-trades?weeks=${w}`);
      const j = await r.json();
      setRows(j.rows ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows(weeks);
    setDrafts({});   // clear unsaved edits when window changes
  }, [weeks, fetchRows]);

  const handleWeeksChange = (w: number) => setWeeks(w);

  const setField = (tradeId: string, field: keyof LiveDraftFields, value: boolean | null, orig: boolean | null) =>
    setDrafts(prev => {
      const row = { ...(prev[tradeId] ?? {}) };
      if (value === orig) {
        delete row[field];
      } else {
        row[field] = value;
      }
      if (Object.keys(row).length === 0) {
        const next = { ...prev };
        delete next[tradeId];
        return next;
      }
      return { ...prev, [tradeId]: row };
    });

  const pendingCount = Object.keys(drafts).length;

  const handleSubmit = async () => {
    const updates = Object.entries(drafts)
      .filter(([, d]) => d && Object.keys(d).length > 0)
      .map(([trade_id, fields]) => ({ trade_id, ...fields }));
    if (!updates.length) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/session/live-trades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (res.ok) {
        setDrafts({});
        fetchRows(weeks);  // refresh table data
        onRefresh?.();     // notify parent (updates JournalTimeline liveRows)
        window.dispatchEvent(new CustomEvent("pipeline-refresh")); // trigger banner update
      }
    } finally {
      setSubmitting(false);
    }
  };

  const effectiveBool = (tradeId: string, field: keyof LiveDraftFields, orig: boolean | null): boolean | null =>
    field in (drafts[tradeId] ?? {}) ? (drafts[tradeId]![field] ?? null) : orig;

  const isIncomplete = (r: LiveRow) =>
    BOOL_FIELDS.some(f => effectiveBool(r.trade_id, f, r[f] as boolean | null) === null);

  const handleColClick = (key: LiveSortKey) => {
    if (key === sortKey) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(-1); }
  };

  const filtered = liveFilter === "queue"
    ? rows.filter(r => !isTradeProcessed(r))
    : liveFilter === "processed"
      ? rows.filter(isTradeProcessed)
      : rows;

  const sorted = sortLiveRows(filtered, sortKey, sortDir, isIncomplete);

  const thSort: React.CSSProperties = {
    ...TH,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  return (
    <div className="card">
      <CardHeader
        eyebrow="Live" eyebrowColor="var(--red)" title="Trade"
        badge={<span className="chip chip-red"><span style={{ display:"inline-block", width:5, height:5, borderRadius:"50%", background:"var(--red)", marginRight:5, verticalAlign:"middle" }}/>LIVE</span>}
        right={<span className="chip chip-muted">{sorted.length} / {rows.length}</span>}
        actions={
          <>
            {/* Week range selector */}
            <div style={{ display: "flex", gap: 1, padding: 2, background: "var(--sub)", borderRadius: 5, border: "1px solid var(--line)" }}>
              {WEEK_OPTIONS.map(w => {
                const active = weeks === w;
                return (
                  <button key={w} type="button" onClick={() => handleWeeksChange(w)} style={{
                    padding: "2px 7px", border: "none", borderRadius: 3,
                    background: active ? "var(--card)" : "transparent",
                    color: active ? "var(--ink-0)" : "var(--ink-3)",
                    fontSize: 10, fontWeight: active ? 700 : 400,
                    cursor: "pointer", transition: "background 0.12s, color 0.12s",
                    whiteSpace: "nowrap",
                  }}>
                    {w}W
                  </button>
                );
              })}
            </div>
            {/* Queue / All / Done filter */}
            <div style={{ display: "flex", gap: 1, padding: 2, background: "var(--sub)", borderRadius: 5, border: "1px solid var(--line)" }}>
              {(["queue", "all", "processed"] as const).map(f => {
                const active = liveFilter === f;
                const label = f === "queue" ? "Queue" : f === "processed" ? "Done" : "All";
                return (
                  <button key={f} type="button" onClick={() => setLiveFilter(f)} style={{
                    padding: "2px 8px", border: "none", borderRadius: 3,
                    background: active ? "var(--card)" : "transparent",
                    color: active
                      ? f === "queue" ? "var(--red)" : f === "processed" ? "var(--green)" : "var(--ink-0)"
                      : "var(--ink-3)",
                    fontSize: 10, fontWeight: active ? 700 : 400,
                    cursor: "pointer", transition: "background 0.12s, color 0.12s",
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <IconBtn icon="refresh" onClick={() => fetchRows(weeks)}/>
            {isAnalyst && pendingCount > 0 && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 4,
                  border: "1px solid rgba(240,160,48,0.35)",
                  background: submitting ? "rgba(240,160,48,0.05)" : "rgba(240,160,48,0.10)",
                  color: "var(--amber)", cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.03em",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? "Saving…" : `Submit ${pendingCount} change${pendingCount > 1 ? "s" : ""}`}
              </button>
            )}
          </>
        }
      />
      <HorizScrollContainer style={{ width: "100%" }} innerStyle={{ overscrollBehavior: "contain" }}>
        <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", userSelect: "none" }}>
          <thead>
            <tr>
              {LIVE_COLS.map(({ label, key }) => (
                <th key={key} style={thSort} onClick={() => handleColClick(key)}>
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    {label}
                    <SortChevron active={sortKey === key} dir={sortKey === key ? sortDir : -1} />
                  </span>
                </th>
              ))}
              {onHydrate && <th style={{ ...thSort, cursor: "default" }} />}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={LIVE_COLS.length + (onHydrate ? 1 : 0)} style={{ padding: "44px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>Loading…</td></tr>
            )}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={LIVE_COLS.length + (onHydrate ? 1 : 0)} style={{ padding: "44px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>
                {liveFilter === "queue" ? "No trades in queue" : liveFilter === "processed" ? "No processed trades yet" : "No trades"}
              </td></tr>
            )}
            {!loading && sorted.map((r, i) => {
              const id       = r.trade_id;
              const hasDraft = id in drafts;
              const bad      = isIncomplete(r);
              return (
                <tr key={i} style={{
                  background:  hasDraft ? "rgba(240,160,48,0.03)" : bad ? "rgba(240,58,87,0.03)" : "transparent",
                  borderLeft:  hasDraft ? "2px solid rgba(240,160,48,0.35)" : "2px solid transparent",
                }}>
                  <td style={{ ...TD, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
                    <CopyCell value={id} display={id.slice(0, 8) + "…"} />
                  </td>
                  <td style={TD}>
                    <CopyCell value={utcToLocalInput(r.entry, tz)} display={fmtTz(r.entry, tz)} />
                  </td>
                  <td style={TD}>
                    <CopyCell value={r.exit ? utcToLocalInput(r.exit, tz) : ""} display={fmtTz(r.exit, tz)} />
                  </td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono)", color: r.result_r > 0 ? "var(--green)" : r.result_r < 0 ? "var(--red)" : "var(--ink-3)" }}>
                    {r.result_r != null ? (r.result_r > 0 ? "+" : "") + r.result_r.toFixed(2) + "R" : "—"}
                  </td>
                  {(["cor_dir","cor_lock","cor_target","cor_rm","cor_entry"] as const).map(f => (
                    <td key={f} style={{ ...TD, paddingTop: 4, paddingBottom: 4 }}>
                      {isAnalyst
                        ? <BoolSelect
                            value={effectiveBool(id, f, r[f] as boolean | null)}
                            changed={f in (drafts[id] ?? {})}
                            onChange={v => setField(id, f, v, r[f] as boolean | null)}
                          />
                        : <BoolBadge value={r[f] as boolean | null} />}
                    </td>
                  ))}
                  <td style={{ ...TD, paddingTop: 4, paddingBottom: 4 }}>
                    {isAnalyst
                      ? <BoolSelect
                          value={effectiveBool(id, "is_bad", r.is_bad)}
                          changed={"is_bad" in (drafts[id] ?? {})}
                          onChange={v => setField(id, "is_bad", v, r.is_bad)}
                          invert
                        />
                      : <BoolBadge value={r.is_bad} invert />}
                  </td>
                  <td style={TD}>
                    {bad
                      ? <span style={{ fontSize: 10, fontWeight: 700, color: "var(--red)",   letterSpacing: "0.05em" }}>INCOMPLETE</span>
                      : <span style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", letterSpacing: "0.05em" }}>DONE</span>}
                  </td>
                  {onHydrate && (
                    <td style={{ ...TD, width: 28, paddingLeft: 4, paddingRight: 8 }}>
                      <button
                        type="button"
                        title="Fill optimal trade form"
                        onClick={() => onHydrate({
                          tradeId: r.trade_id,
                          entry: utcToLocalInput(r.entry, tz),
                          exit: r.exit ? utcToLocalInput(r.exit, tz) : "",
                        })}
                        style={{
                          background: "none", border: "1px solid var(--line)", borderRadius: 3,
                          color: "var(--ink-3)", cursor: "pointer", fontSize: 12, lineHeight: 1,
                          padding: "2px 5px", display: "flex", alignItems: "center",
                          transition: "border-color 0.12s, color 0.12s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--green)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--green)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";  (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-3)"; }}
                      >
                        ↗
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </HorizScrollContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SESSION JOURNAL  —  trade Gantt + comment timeline
═══════════════════════════════════════════════════════════ */
/* Y-scale constants */
const TL_PAD      = 24;   // top/bottom canvas padding
const TL_COL_W    = 12;   // trade column width
const TL_MIN_BAR  = 6;    // minimum trade bar height
const TL_PX_HR    = 44;   // px per hour between adjacent key events
const TL_MAX_GAP  = 52;   // px cap on any single inter-event gap
const TL_MIN_GAP  = 20;   // minimum px between any two key events
const TL_LEFT_ZONE = 100; // px reserved left of axis for day labels

/* Non-linear Y scale: caps empty gaps so whitespace stays proportional but bounded */
function buildYScale(keyMs: number[]): [number, number][] {
  const sorted = [...new Set(keyMs)].sort((a, b) => a - b);
  if (!sorted.length) return [];
  const pts: [number, number][] = [[sorted[0], TL_PAD]];
  let y = TL_PAD;
  for (let i = 1; i < sorted.length; i++) {
    const hrs = (sorted[i] - sorted[i - 1]) / 3_600_000;
    y += Math.min(TL_MAX_GAP, Math.max(TL_MIN_GAP, hrs * TL_PX_HR));
    pts.push([sorted[i], y]);
  }
  return pts;
}

function yAt(ms: number, pts: [number, number][]): number {
  if (!pts.length) return TL_PAD;
  if (ms <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (ms >= last[0]) return last[1];
  let lo = 0, hi = pts.length - 1;
  while (lo < hi - 1) {
    const m = (lo + hi) >> 1;
    if (pts[m][0] <= ms) lo = m; else hi = m;
  }
  const [t0, y0] = pts[lo], [t1, y1] = pts[hi];
  return y0 + ((ms - t0) / (t1 - t0)) * (y1 - y0);
}

function assignTradeCols(trades: OptimalRow[]): { trade: OptimalRow; col: number }[] {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.entry).getTime() - new Date(b.entry).getTime()
  );
  const ends: number[] = [];
  return sorted.map(tr => {
    const s = new Date(tr.entry).getTime();
    const e = new Date(tr.exit).getTime();
    let c = 0;
    while (c < ends.length && ends[c] > s) c++;
    if (c === ends.length) ends.push(0);
    ends[c] = e;
    return { trade: tr, col: c };
  });
}

/* Trade bar — expands detail card on hover; double-click pins it and scrolls to it */
function TLTrade({ trade, y1, y2, col, axisX, tz, selected, onDoubleClick }: {
  trade: OptimalRow; y1: number; y2: number; col: number; axisX: number; tz: string;
  selected?: boolean; onDoubleClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const be  = Math.abs(trade.result_r) <= 0.08;
  const win = !be && trade.result_r > 0;
  const clr = be ? "#888888" : win ? "#00cc7a" : "#f03a57";
  const bgHi  = be ? "rgba(136,136,136,0.22)" : win ? "rgba(0,204,122,0.26)" : "rgba(240,58,87,0.24)";
  const bgLo  = be ? "rgba(136,136,136,0.10)" : win ? "rgba(0,204,122,0.13)" : "rgba(240,58,87,0.11)";
  const top = Math.min(y1, y2);
  const h   = Math.max(TL_MIN_BAR, Math.abs(y2 - y1));
  const x   = 8 + col * TL_COL_W;
  const showCard = hover || selected;

  return (
    <div
      style={{ position: "absolute", left: x, top, width: TL_COL_W - 2, zIndex: showCard ? 30 : 1 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDoubleClick={onDoubleClick}
    >
      {/* Bar */}
      <div style={{
        width: "100%", height: h, borderRadius: 3,
        background: showCard ? bgHi : bgLo,
        borderTop:    `1px solid ${clr}${showCard ? "88" : "44"}`,
        borderRight:  `1px solid ${clr}${showCard ? "88" : "44"}`,
        borderBottom: `1px solid ${clr}${showCard ? "88" : "44"}`,
        borderLeft:   `3px solid ${clr}`,
        outline: selected ? `2px solid ${clr}88` : "none",
        outlineOffset: 1,
        transition: "background 0.12s, border-color 0.12s",
        cursor: "pointer",
      }} />

      {/* Detail card — shows on hover or when pinned via double-click */}
      {showCard && (
        <div style={{
          position: "absolute",
          left: axisX - x + 10,
          top: 0,
          zIndex: 40,
          background: "var(--card)",
          borderTop:    `1px solid ${clr}44`,
          borderRight:  `1px solid ${clr}44`,
          borderBottom: `1px solid ${clr}44`,
          borderLeft:   `2px solid ${clr}`,
          borderRadius: 6,
          padding: "9px 13px",
          boxShadow: selected ? `0 6px 28px rgba(0,0,0,0.50), 0 0 0 1px ${clr}33` : "0 6px 28px rgba(0,0,0,0.40)",
          width: "min(220px, calc(100vw - 80px))",
          pointerEvents: "none",
          whiteSpace: "normal",
          wordBreak: "break-word",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: clr }}>
              {be ? "◆ BREAKEVEN" : win ? "▲ WINNER" : "▼ LOSER"}
              <span style={{ marginLeft: 10, fontSize: 13, fontFamily: "var(--font-mono)" }}>
                {win ? "+" : ""}{trade.result_r}R
              </span>
            </span>
            {selected && <span style={{ marginLeft: "auto", fontSize: 8.5, color: clr, opacity: 0.65, letterSpacing: "0.05em" }}>● PINNED</span>}
          </div>
          <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--ink-2)", lineHeight: 2 }}>
            <span style={{ color: "var(--ink-3)", display: "inline-block", width: 34 }}>Entry</span>
            {fmtTz(trade.entry, tz)}
          </div>
          <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--ink-2)", lineHeight: 2 }}>
            <span style={{ color: "var(--ink-3)", display: "inline-block", width: 34 }}>Exit</span>
            {fmtTz(trade.exit, tz)}
          </div>
          {trade.trade_id && (
            <div style={{
              marginTop: 7, paddingTop: 7,
              borderTop: "1px solid var(--line)",
              fontSize: 9.5, fontFamily: "var(--font-mono)", color: "#4d9cf5",
            }}>
              {trade.trade_id.slice(0, 26)}…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Comment node — focus/blur managed by parent */
function TLComment({ comment, top, axisX, focused, dimmed, onFocus, onBlur, tz, canDelete, onDelete, planExpanded, onPlanExpandToggle }: {
  comment: CommentRow; top: number; axisX: number;
  focused: boolean; dimmed: boolean; tz: string;
  onFocus: () => void; onBlur: () => void;
  canDelete?: boolean; onDelete?: () => Promise<void>;
  planExpanded?: boolean; onPlanExpandToggle?: () => void;
}) {
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [copiedPlanId, setCopiedPlanId] = useState(false);

  const analyst     = comment.content.startsWith("Analyst comment:");
  const isEntryPlan = comment.content.startsWith("entry_plan:");
  let planData: {
    id?: string;
    immediate?: boolean;
    entries?: { label: string; datetime: string; anchor: boolean }[];
    anchor_reason?: string;
    entry_time?: string;
  } | null = null;
  if (isEntryPlan) {
    try { planData = JSON.parse(comment.content.replace(/^entry_plan:\s*/, "")); } catch {}
  }
  const text   = analyst ? comment.content.replace(/^Analyst comment:\s*/i, "") : comment.content;
  const accent = analyst ? "#f0a030" : isEntryPlan ? "#00cc7a" : "#4d9cf5";

  const handleBlur = () => { if (!showConfirm) onBlur(); };

  async function doDelete() {
    if (!onDelete) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    setShowConfirm(false);
  }

  const cardExpanded = isEntryPlan
    ? ((planExpanded ?? false) || showConfirm)
    : (focused || showConfirm);

  /* Entry plans never get dimmed by other items' hover */
  const isDimmed = dimmed && !isEntryPlan;

  return (
    <div
      style={{
        position: "absolute", top, left: axisX + 10,
        width: `calc(100% - ${axisX + 18}px)`,
        zIndex: cardExpanded ? 20 : 1,
        opacity: isDimmed ? 0.25 : 1,
        filter:  isDimmed ? "blur(1.5px)" : "none",
        transition: "opacity 0.18s, filter 0.18s",
        minHeight: 26,
      }}
      onMouseEnter={isEntryPlan ? undefined : onFocus}
      onMouseLeave={isEntryPlan ? undefined : handleBlur}
    >
      {/* Axis dot */}
      <div style={{
        position: "absolute", left: -14, top: 9,
        width: 8, height: 8, borderRadius: "50%",
        background: cardExpanded ? accent : "var(--sub)",
        border: `2px solid ${accent}`,
        boxShadow: cardExpanded
          ? `0 0 0 4px ${analyst ? "rgba(240,160,48,0.18)" : isEntryPlan ? "rgba(0,204,122,0.18)" : "rgba(77,156,245,0.18)"}`
          : "none",
        transition: "background 0.15s, box-shadow 0.15s",
      }} />

      {/* Card — floats above siblings when expanded */}
      <div
        onClick={isEntryPlan ? onPlanExpandToggle : undefined}
        style={{
          position: (cardExpanded && !isEntryPlan) ? "absolute" as const : "relative" as const,
          top: (cardExpanded && !isEntryPlan) ? 0 : undefined,
          left: (cardExpanded && !isEntryPlan) ? 0 : undefined,
          right: (cardExpanded && !isEntryPlan) ? 0 : undefined,
          zIndex: cardExpanded ? 30 : undefined,
          background: cardExpanded ? "var(--card)" : "transparent",
          borderTop:    `1px solid ${cardExpanded ? accent + "44" : "transparent"}`,
          borderRight:  `1px solid ${cardExpanded ? accent + "44" : "transparent"}`,
          borderBottom: `1px solid ${cardExpanded ? accent + "44" : "transparent"}`,
          borderLeft:   `2px solid ${accent}`,
          borderRadius: 5,
          padding: cardExpanded ? "8px 12px" : "3px 10px",
          transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
          boxShadow: cardExpanded ? "0 6px 28px rgba(0,0,0,0.38)" : "none",
          minWidth: 0, width: "100%",
          boxSizing: "border-box" as const,
          overflow: "hidden",
          cursor: isEntryPlan ? "pointer" : "default",
        }}>

        {!cardExpanded ? (
          /* ── Collapsed: single row — timestamp · text ── */
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={{
              fontSize: 10, fontFamily: "var(--font-mono)", color: accent,
              flexShrink: 0, whiteSpace: "nowrap",
            }}>
              {fmtTz(comment.Entry, tz)}
            </span>
            {isEntryPlan ? (
              <span style={{ fontSize: 11.5, color: "var(--green)", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
                ⚡ Entry Plan{planData?.immediate ? " · Immediate" : ""}{planData?.entries?.length ? ` · ${planData.entries.length} entries` : ""}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--ink-1)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
                {text}
              </span>
            )}
            {analyst && <span className="chip chip-amber" style={{ fontSize: 7.5, flexShrink: 0 }}>A</span>}
            {isEntryPlan && (
              <span style={{ fontSize: 7.5, flexShrink: 0, background: "rgba(0,204,122,0.12)", border: "1px solid rgba(0,204,122,0.3)", borderRadius: 3, padding: "1px 4px", color: "var(--green)", letterSpacing: "0.04em" }}>EP</span>
            )}
          </div>
        ) : (
          /* ── Expanded: full card ── */
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap", minWidth: 0 }}>
              <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: accent, fontWeight: 600, flexShrink: 0 }}>
                {fmtTz(comment.Entry, tz)}
              </span>
              {comment.trade_id && (
                <span style={{ fontSize: 8.5, fontFamily: "var(--font-mono)", color: "#4d9cf5", background: "rgba(77,156,245,0.10)", padding: "1px 5px", borderRadius: 2, flexShrink: 0 }}>
                  {comment.trade_id.slice(0, 8)}…
                </span>
              )}
              {analyst && <span className="chip chip-amber" style={{ fontSize: 8, flexShrink: 0 }}>Analyst</span>}
              {canDelete && (analyst || isEntryPlan) && !showConfirm && (
                <button type="button" onClick={e => { e.stopPropagation(); setShowConfirm(true); }}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0, opacity: 0.7 }}>
                  ×
                </button>
              )}
            </div>

            {/* ── Entry Plan formatted card ── */}
            {isEntryPlan && planData ? (
              <div style={{ marginTop: 2 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", background: "rgba(0,204,122,0.12)", border: "1px solid rgba(0,204,122,0.3)", borderRadius: 3, padding: "2px 7px", color: "var(--green)" }}>⚡ ENTRY PLAN</span>
                  {planData.immediate && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", background: "rgba(77,156,245,0.10)", border: "1px solid rgba(77,156,245,0.25)", borderRadius: 3, padding: "2px 7px", color: "#4d9cf5" }}>IMMEDIATE</span>}
                </div>
                {planData.id && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ margin: "0 0 3px", fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", color: "var(--ink-3)", textTransform: "uppercase" as const }}>Plan ID</p>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(planData!.id!).catch(() => {});
                        setCopiedPlanId(true);
                        setTimeout(() => setCopiedPlanId(false), 1400);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "5px 8px", borderRadius: 4, cursor: "copy",
                        background: copiedPlanId ? "rgba(0,204,122,0.07)" : "rgba(255,255,255,0.025)",
                        border: `1px solid ${copiedPlanId ? "rgba(0,204,122,0.28)" : "var(--line)"}`,
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: copiedPlanId ? "var(--green)" : "var(--ink-2)", flex: 1, textAlign: "left", wordBreak: "break-all", letterSpacing: "0.03em" }}>
                        {copiedPlanId ? "✓ copied to clipboard" : planData.id}
                      </span>
                      {!copiedPlanId && (
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
                          <rect x="5" y="1" width="10" height="12" rx="1.5" stroke="var(--ink-2)" strokeWidth="1.5"/>
                          <rect x="1" y="4" width="10" height="12" rx="1.5" stroke="var(--ink-2)" strokeWidth="1.5" fill="var(--card)"/>
                        </svg>
                      )}
                    </button>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                  {planData.entries?.map((entry, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 5, background: entry.anchor ? "rgba(0,204,122,0.07)" : "var(--sub)", border: `1px solid ${entry.anchor ? "rgba(0,204,122,0.3)" : "var(--line)"}` }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: entry.anchor ? "var(--green)" : "var(--ink-3)", width: 48, flexShrink: 0 }}>{entry.label}</span>
                      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: entry.anchor ? "var(--green)" : "var(--ink-1)", flex: 1 }}>{fmtTz(entry.datetime, tz)}</span>
                      {entry.anchor && <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(0,204,122,0.15)", border: "1px solid rgba(0,204,122,0.35)", borderRadius: 3, padding: "1px 6px", color: "var(--green)", flexShrink: 0 }}>⚓ ANCHOR</span>}
                    </div>
                  ))}
                </div>
                {planData.anchor_reason && (
                  <div style={{ padding: "8px 10px", borderRadius: 5, background: "var(--sub)", border: "1px solid var(--line)", marginBottom: 8 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase" as const }}>Anchor Rationale</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--ink-1)", lineHeight: 1.6 }}>{planData.anchor_reason}</p>
                  </div>
                )}
                {planData.entry_time && (
                  <p style={{ margin: 0, fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                    Submitted: {fmtTz(planData.entry_time, tz)}
                  </p>
                )}
              </div>
            ) : (
              <p style={{
                margin: 0, fontSize: 12.5, lineHeight: 1.65,
                color: "var(--ink-0)", wordBreak: "break-word", overflowWrap: "break-word",
              }}>
                {text}
              </p>
            )}
            {showConfirm && (
              <div style={{ marginTop: 10, background: "var(--card)", border: "1px solid var(--line-hi)", borderRadius: 6, padding: "12px 14px" }}>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-0)", fontWeight: 600 }}>Delete this comment?</p>
                <p style={{ margin: "0 0 12px", fontSize: 10.5, color: "var(--red)" }}>This cannot be undone.</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" disabled={deleting} onClick={() => setShowConfirm(false)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 5, background: "var(--sub)", border: "1px solid var(--line-hi)", color: "var(--ink-1)", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    Cancel
                  </button>
                  <button type="button" disabled={deleting} onClick={doDelete}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 5, background: "var(--sub)", border: "1px solid rgba(240,58,87,0.6)", color: "var(--red)", fontSize: 12, cursor: deleting ? "default" : "pointer", fontWeight: 700 }}>
                    {deleting ? "Deleting…" : "Yes, proceed"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* Return UTC ms for Monday 00:00 of the current Melbourne week */
function weekStartMs(): number {
  const now  = new Date();
  const melb = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const dow  = melb.getDay();                         // 0=Sun … 6=Sat
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const yr   = melb.getFullYear();
  const mo   = String(melb.getMonth() + 1).padStart(2, "0");
  const dy   = String(melb.getDate() - daysFromMon).padStart(2, "0");
  return new Date(tzLocalToUTC(`${yr}-${mo}-${dy}T00:00`, "Australia/Melbourne")).getTime();
}

function JournalTimeline({
  trades, tradingLoading, comments, commentsLoading, tz, analystMode, operatorView, liveRows, onDeleteComment, onRefresh,
}: {
  trades: OptimalRow[];    tradingLoading: boolean;
  comments: CommentRow[];  commentsLoading: boolean; tz: string;
  analystMode?: boolean;
  operatorView?: boolean;
  liveRows?: LiveRow[];
  onDeleteComment?: (id: string) => Promise<void>;
  onRefresh?: () => void;
}) {
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [expandedPlanIndices, setExpandedPlanIndices] = useState<Set<number>>(new Set());
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tradeSource, setTradeSource] = useState<"optimal" | "live">("optimal");
  const scrollRef = useRef<HTMLDivElement>(null);
  const loading = tradingLoading || commentsLoading;

  /* Normalise LiveRow → OptimalRow shape so timeline rendering is unchanged */
  const liveAsOptimal = (rows: LiveRow[]): OptimalRow[] => rows.map(r => ({
    optimal_trade_id: r.trade_id,
    trade_id:         r.trade_id,
    result_r:         r.result_r,
    entry:            r.entry,
    exit:             r.exit,
    created_at:       r.entry,
  }));

  const effectiveTrades = analystMode && tradeSource === "live"
    ? liveAsOptimal(liveRows ?? [])
    : trades;

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const togglePlan = (idx: number) =>
    setExpandedPlanIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });

  /* ── Operator view filters ── */
  const weekMs = operatorView ? weekStartMs() : 0;
  const isSystemRow = (content: string) =>
    content.startsWith("session_contract:") ||
    content.startsWith("alarm_state:") ||
    content.startsWith("watch_device:") ||
    content.startsWith("analysis_session:");

  const visibleComments = operatorView
    ? comments.filter(c =>
        !c.content.startsWith("Analyst comment:") &&
        !isSystemRow(c.content) &&
        new Date(c.Entry).getTime() >= weekMs
      )
    : comments.filter(c => !isSystemRow(c.content));
  const visibleTrades = operatorView
    ? effectiveTrades.filter(t => new Date(t.entry).getTime() >= weekMs)
    : effectiveTrades;

  /* ── collect all key timestamps for non-linear scale ── */
  const keyMs: number[] = [
    ...visibleTrades.flatMap(t => [new Date(t.entry).getTime(), new Date(t.exit).getTime()]),
    ...visibleComments.map(c => new Date(c.Entry).getTime()),
  ].filter(n => !isNaN(n));

  const hasData = keyMs.length > 0;
  const minT    = hasData ? Math.min(...keyMs) : 0;
  const maxT    = hasData ? Math.max(...keyMs) : 0;

  /* Add midnight boundaries as key points (keeps day ticks proportional) */
  if (hasData) {
    const d = new Date(minT); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1);
    while (d.getTime() <= maxT) { keyMs.push(d.getTime()); d.setDate(d.getDate() + 1); }
  }

  const yPts    = buildYScale(keyMs);
  const totalPx = yPts.length ? yPts[yPts.length - 1][1] : TL_PAD;
  /* Flip: newest at top — invert the raw Y so maxT → TL_PAD, minT → totalPx */
  const toY    = (iso: string) => totalPx + TL_PAD - yAt(new Date(iso).getTime(), yPts);
  const toYMs  = (ms: number)  => totalPx + TL_PAD - yAt(ms, yPts);

  /* ── trade layout ────────────────────────────────────── */
  const placed  = assignTradeCols(visibleTrades);
  const numCols = placed.length ? Math.max(...placed.map(p => p.col)) + 1 : 1;
  const AXIS_X  = TL_LEFT_ZONE + numCols * TL_COL_W;

  /* ── comment positions with collision avoidance ─────── */
  const PLAN_EXTRA = 300; // extra canvas px when an entry plan is expanded
  const commentTops: number[] = (() => {
    const raw = visibleComments.map((c, i) => ({ i, y: toY(c.Entry) - 12 }));
    raw.sort((a, b) => a.y - b.y);
    const out = visibleComments.map(c => toY(c.Entry) - 12);
    let prevY = -Infinity;
    for (const { i, y } of raw) {
      const placed = Math.max(y, prevY + 40);
      out[i] = placed;
      prevY = placed;
    }
    // Second pass: push comments below expanded entry plans down
    let extra = 0;
    for (const { i } of raw) {
      out[i] += extra;
      if (expandedPlanIndices.has(i) && visibleComments[i].content.startsWith("entry_plan:")) {
        extra += PLAN_EXTRA;
      }
    }
    return out;
  })();
  const totalExtra = [...expandedPlanIndices].reduce(
    (sum, idx) => visibleComments[idx]?.content.startsWith("entry_plan:") ? sum + PLAN_EXTRA : sum, 0
  );

  /* ── midnight day ticks ──────────────────────────────── */
  const ticks: { label: string; y: number }[] = [];
  if (hasData) {
    const d = new Date(minT); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1);
    while (d.getTime() <= maxT) {
      ticks.push({
        label: d.toLocaleDateString("en-AU", {
          timeZone: tz,
          weekday: "short", month: "short", day: "numeric",
        }),
        y: toYMs(d.getTime()),
      });
      d.setDate(d.getDate() + 1);
    }
  }

  return (
    <div
      className="card"
      style={{
        overflow: "hidden",
        ...(isFullscreen ? {
          position: "fixed", inset: 0, zIndex: 9000,
          borderRadius: 0,
          display: "flex", flexDirection: "column",
          background: "var(--bg, #04080f)",
        } : {}),
      }}
    >
      <CardHeader
        title="Session Journal"
        badge={!loading && hasData
          ? <span className="chip chip-muted">{visibleTrades.length} trades · {visibleComments.length} comments · {operatorView ? "this week" : "last 2w"}</span>
          : undefined}
        actions={<>
          {analystMode && (
            <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--sub)", borderRadius: 5, border: "1px solid var(--line)" }}>
              {(["optimal", "live"] as const).map(src => {
                const active = tradeSource === src;
                return (
                  <button key={src} type="button" onClick={() => setTradeSource(src)} style={{
                    padding: "3px 10px", border: "none", borderRadius: 3,
                    background: active ? "var(--card)" : "transparent",
                    color: active ? "var(--ink-0)" : "var(--ink-3)",
                    fontSize: 10.5, fontWeight: active ? 600 : 400, cursor: "pointer",
                    transition: "background 0.15s, color 0.15s",
                  }}>
                    {src === "optimal" ? "Optimal" : "Live"}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen(o => !o)}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Expand to fullscreen"}
            style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "var(--ink-3)", display: "flex", alignItems: "center" }}
          >
            {isFullscreen ? (
              /* compress icon */
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              /* expand icon */
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          <IconBtn icon="refresh" onClick={onRefresh} />
        </>}
      />
      <div
        ref={scrollRef}
        style={{
          overflowY: "auto", overflowX: "hidden", width: "100%", padding: "16px 0",
          ...(isFullscreen ? { flex: 1 } : { maxHeight: 560 }),
        }}
      >
        {loading && (
          <div style={{ padding: "44px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>Loading…</div>
        )}
        {!loading && !hasData && (
          <div style={{ padding: "44px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>{operatorView ? "No data this week" : "No data in the last 2 weeks"}</div>
        )}
        {!loading && hasData && (
          <div style={{ position: "relative", width: "100%", height: totalPx + TL_PAD + totalExtra, minHeight: 280, overflow: "hidden" }}>

            {/* Axis */}
            <div style={{ position: "absolute", left: AXIS_X, top: 0, bottom: 0, width: 2, background: "var(--line-hi)", borderRadius: 1 }} />

            {/* Day dividers — pill label + full-width line */}
            {ticks.map((t, i) => (
              <div key={i} style={{ position: "absolute", top: t.y, left: 0, right: 0, height: 20, pointerEvents: "none" }}>
                {/* Line left of label */}
                <div style={{ position: "absolute", top: 10, left: 8, right: `calc(100% - ${AXIS_X / 2 - 4}px)`, height: 1, background: "var(--line-hi)" }} />
                {/* Line right of label */}
                <div style={{ position: "absolute", top: 10, left: `${AXIS_X / 2 + 4}px`, right: 8, height: 1, background: "var(--line-hi)" }} />
                {/* Pill */}
                <span style={{
                  position: "absolute",
                  left: "50%", transform: `translateX(calc(-50% - ${(AXIS_X / 2)}px))`,
                  top: 3,
                  background: "var(--sub)",
                  border: "1px solid var(--line-hi)",
                  borderRadius: 20,
                  padding: "1px 10px",
                  fontSize: 9.5,
                  fontFamily: "var(--font-mono)",
                  color: "var(--ink-1)",
                  whiteSpace: "nowrap",
                  letterSpacing: "0.02em",
                }}>
                  {t.label}
                </span>
                {/* Axis notch */}
                <div style={{ position: "absolute", left: AXIS_X - 1, top: 6, width: 3, height: 9, background: "var(--line-hi)", borderRadius: 1 }} />
              </div>
            ))}

            {/* Trade bars */}
            {placed.map(({ trade, col }) => {
              const tradeTop = Math.min(toY(trade.entry), toY(trade.exit));
              return (
                <TLTrade
                  key={trade.optimal_trade_id}
                  trade={trade}
                  y1={toY(trade.entry)}
                  y2={toY(trade.exit)}
                  col={col}
                  axisX={AXIS_X}
                  tz={tz}
                  selected={selectedTradeId === trade.optimal_trade_id}
                  onDoubleClick={() => {
                    const isNowSelected = selectedTradeId !== trade.optimal_trade_id;
                    setSelectedTradeId(isNowSelected ? trade.optimal_trade_id : null);
                    if (isNowSelected && scrollRef.current) {
                      scrollRef.current.scrollTo({
                        top: Math.max(0, tradeTop - 200),
                        behavior: "smooth",
                      });
                    }
                  }}
                />
              );
            })}

            {/* Comment nodes */}
            {visibleComments.map((c, i) => (
              <TLComment
                key={c.id ?? i}
                comment={c}
                top={commentTops[i]}
                axisX={AXIS_X}
                tz={tz}
                focused={focusedIdx === i}
                dimmed={focusedIdx !== null && focusedIdx !== i}
                onFocus={() => setFocusedIdx(i)}
                onBlur={() => setFocusedIdx(null)}
                canDelete={analystMode}
                onDelete={onDeleteComment ? () => onDeleteComment(c.created_at) : undefined}
                planExpanded={expandedPlanIndices.has(i)}
                onPlanExpandToggle={() => togglePlan(i)}
              />
            ))}

          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RECORD TRADE FORM
═══════════════════════════════════════════════════════════ */
type TradeHydrate = { tradeId: string; entry: string; exit: string };

function RecordTradeForm({ selectedId, hydrate, onSuccess, showToast, baseTZ }: { selectedId: string | null; hydrate?: TradeHydrate | null; onSuccess?: () => void; showToast: ShowToast; baseTZ: string }) {
  const [tradeId, setTradeId] = useState("");
  const [entry,   setEntry]   = useState(() => nowInTZ(baseTZ));
  const [exit_,   setExit]    = useState(() => nowInTZ(baseTZ));
  const [exemptR, setExemptR] = useState("0");
  const [result,  setResult]  = useState("0");
  const [exemp,   setExemp]   = useState("false");
  const [submitting, setSubmitting] = useState(false);
  const [lastErr,    setLastErr]    = useState<string | null>(null);

  useEffect(() => { if (selectedId) setTradeId(selectedId); }, [selectedId]);

  useEffect(() => {
    if (!hydrate) return;
    setTradeId(hydrate.tradeId);
    setEntry(hydrate.entry);
    setExit(hydrate.exit);
  }, [hydrate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLastErr(null);
    try {
      const res = await fetch("/api/session/optimal-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trade_id:  tradeId || undefined,
          result_r:  parseFloat(result),
          entry:     tzLocalToUTC(entry, baseTZ),
          exit:      tzLocalToUTC(exit_, baseTZ),
          exempt_r:  parseFloat(exemptR),
          is_exempt: exemp === "true",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = j.error ?? `Server error ${res.status}`;
        setLastErr(msg);
        showToast("error", msg);
      } else {
        showToast("success", "Optimal trade recorded");
        setTradeId("");
        setEntry(nowInTZ(baseTZ));
        setExit(nowInTZ(baseTZ));
        setExemptR("0");
        setResult("0");
        setExemp("false");
        setLastErr(null);
        onSuccess?.();
      }
    } catch (e) {
      const msg = "Network error — trade not saved";
      setLastErr(msg);
      showToast("error", msg);
    }
    setSubmitting(false);
  }

  const nowLabel = fmtTz(new Date().toISOString(), baseTZ);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "4px 10px", padding: "13px 16px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)" }}>Optimal Trade</span>
        <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{nowLabel}</span>
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
        {lastErr && (
          <div style={{ display: "flex", gap: 8, padding: "9px 11px", borderRadius: 5, background: "rgba(240,58,87,0.08)", border: "1px solid rgba(240,58,87,0.25)" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="7" stroke="#f03a57" strokeWidth="1.3"/><path d="M8 5v3.5M8 10.5h.01" stroke="#f03a57" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11.5, color: "var(--red)", lineHeight: 1.5 }}>{lastErr}</span>
          </div>
        )}
        <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%", padding: "11px", fontSize: 12.5, marginTop: 2, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Saving…" : "Submit"}
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADD COMMENT FORM
═══════════════════════════════════════════════════════════ */
function AddCommentForm({ tradeId: initId, fullWidth, isAnalyst, failCompliance, onSuccess, showToast, baseTZ }: { tradeId?: string; fullWidth?: boolean; isAnalyst?: boolean; failCompliance?: boolean; onSuccess?: () => void; showToast: ShowToast; baseTZ: string }) {
  const [content,      setContent]      = useState("");
  const [tradeId,      setTradeId]      = useState(initId ?? "");
  const [createdAt,    setCreatedAt]    = useState(() => nowInTZ(baseTZ));
  const [submitting,   setSubmitting]   = useState(false);
  const [lastErr,      setLastErr]      = useState<string | null>(null);
  const [isLastTrade,  setIsLastTrade]  = useState(false);
  const [contractType, setContractType] = useState<"day" | "week">("day");

  useEffect(() => { if (initId) setTradeId(initId); }, [initId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setLastErr(null);
    const recordStamp   = `record @+ ${fmtTz(new Date().toISOString(), baseTZ)}`;
    const body          = failCompliance ? `fail compliance: ${content.trim()}` : content.trim();
    const final = isAnalyst
      ? `Analyst comment: ${recordStamp}: ${body}`
      : `${recordStamp}: ${body}`;
    try {
      const res = await fetch("/api/session/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trade_id:   tradeId || undefined,
          content:    final,
          created_at: tzLocalToUTC(createdAt, baseTZ),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = j.error ?? `Server error ${res.status}`;
        setLastErr(msg);
        showToast("error", msg);
      } else {
        if (isLastTrade) {
          // Persist session conclude contract server-side as a silent comment
          await fetch("/api/session/comments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content:    `session_contract:${JSON.stringify({ type: contractType, setAt: new Date().toISOString() })}`,
              created_at: new Date().toISOString(),
            }),
          }).catch(() => {});
        }
        showToast("success", isAnalyst ? "Analyst comment added" : "Comment added");
        setContent("");
        setTradeId("");
        setCreatedAt(nowInTZ(baseTZ));
        setIsLastTrade(false);
        onSuccess?.();
      }
    } catch {
      const msg = "Network error — comment not saved";
      setLastErr(msg);
      showToast("error", msg);
    }
    setSubmitting(false);
  }

  const nowLabel = fmtTz(new Date().toISOString(), baseTZ);

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
        {failCompliance && (
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "6px 10px", borderRadius: 5,
            background: "rgba(240,58,87,0.07)",
            border: "1px solid rgba(240,58,87,0.28)",
          }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--red)" strokeWidth="1.4"/><path d="M8 5v3.5M8 10.5h.01" stroke="var(--red)" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 10.5, color: "var(--red)", fontWeight: 600 }}>
              Focus challenge failed — <span style={{ fontFamily: "var(--font-mono)" }}>fail compliance:</span> will be prepended
            </span>
          </div>
        )}

        <div>
          <label style={{ ...LBL, color: "var(--red)" }}>Content *</label>

          {/* Prefix badge — sits flush above the textarea */}
          <div style={{
            padding: "5px 10px",
            background: isAnalyst ? "var(--amber-10)" : "rgba(77,156,245,0.07)",
            border: `1px solid ${isAnalyst ? "rgba(240,160,48,0.22)" : "rgba(77,156,245,0.20)"}`,
            borderBottom: "none",
            borderRadius: "4px 4px 0 0",
            display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          }}>
            {isAnalyst ? (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M6 1L7.5 4.5H11L8 7l1 3.5L6 8.5 3 10.5 4 7 1 4.5h3.5L6 1Z" stroke="var(--amber)" strokeWidth="1" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                <circle cx="6" cy="6" r="4.5" stroke="#4d9cf5" strokeWidth="1.2"/>
                <path d="M6 4v2.5M6 8h.01" stroke="#4d9cf5" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            )}
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              color: isAnalyst ? "var(--amber)" : "#4d9cf5",
              letterSpacing: "0.03em",
              fontFamily: "var(--font-mono)",
            }}>
              {isAnalyst ? "Analyst comment:" : "record @+"} {!isAnalyst && (
                <span style={{ color: "#4d9cf5", opacity: 0.75 }} suppressHydrationWarning>{nowInTZ(baseTZ).replace("T", " ")}</span>
              )}
            </span>
            <span style={{ fontSize: 10, color: isAnalyst ? "rgba(240,160,48,0.5)" : "rgba(77,156,245,0.45)", fontStyle: "italic" }}>
              prepended on submit
            </span>
          </div>

          <textarea
            style={{
              ...INP,
              minHeight: fullWidth ? 160 : 96,
              resize: "vertical",
              borderRadius: "0 0 4px 4px",
              borderTop: `1px solid ${isAnalyst ? "rgba(240,160,48,0.22)" : "rgba(77,156,245,0.20)"}`,
            }}
            placeholder={isAnalyst ? "Your observation or analysis…" : "Enter your observation, decision, or emotional state…"}
            value={content}
            onChange={e => setContent(e.target.value)}
            required
          />
        </div>
        <div><label style={LBL}>Trade ID</label><input style={INP} placeholder="Link to specific trade (optional)" value={tradeId} onChange={e => setTradeId(e.target.value)} /></div>

        {/* Last Trade — session conclude contract (operator only) */}
        {!isAnalyst && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            onClick={() => setIsLastTrade(o => !o)}
          >
            <div style={{
              width: 14, height: 14, borderRadius: 3, flexShrink: 0,
              background: isLastTrade ? "rgba(240,58,87,0.16)" : "var(--sub)",
              border: `1.5px solid ${isLastTrade ? "rgba(240,58,87,0.55)" : "var(--line-hi)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.14s, border-color 0.14s",
            }}>
              {isLastTrade && (
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden>
                  <path d="M1.5 4.5l2 2 4-4" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: isLastTrade ? "var(--red)" : "var(--ink-2)", letterSpacing: "0.01em" }}>
              Last Trade
            </span>
          </div>

          {isLastTrade && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 22, flexWrap: "wrap" }}>
              {(["day", "week"] as const).map(t => {
                const active = contractType === t;
                return (
                  <button key={t} type="button" onClick={() => setContractType(t)} style={{
                    padding: "4px 14px", borderRadius: 4, cursor: "pointer",
                    fontSize: 11, fontWeight: active ? 700 : 400,
                    background: active ? "rgba(240,58,87,0.12)" : "var(--sub)",
                    border: `1px solid ${active ? "rgba(240,58,87,0.42)" : "var(--line-hi)"}`,
                    color: active ? "var(--red)" : "var(--ink-3)",
                    transition: "background 0.12s, border-color 0.12s, color 0.12s",
                  }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                );
              })}
              <span style={{ fontSize: 10, color: "var(--ink-3)", fontStyle: "italic", marginLeft: 2 }}>
                conclude contract recorded on submit
              </span>
            </div>
          )}
        </div>}

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

        {lastErr && (
          <div style={{ display: "flex", gap: 8, padding: "9px 11px", borderRadius: 5, background: "rgba(240,58,87,0.08)", border: "1px solid rgba(240,58,87,0.25)" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="7" stroke="#f03a57" strokeWidth="1.3"/><path d="M8 5v3.5M8 10.5h.01" stroke="#f03a57" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11.5, color: "var(--red)", lineHeight: 1.5 }}>{lastErr}</span>
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={!content.trim() || submitting} style={{ width: "100%", padding: "11px", fontSize: 12.5, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Saving…" : "Submit"}
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ENTRY CHECKLIST FORM  —  Operator mode only
   Not immediate → 3 fields: Skip Anchor 1 · Skip Anchor 2 · Target Anchor
   Immediate     → 2 fields: Skip Anchor 1 · Target Anchor
   Last field is always the Target Anchor (anchor: true in JSON).
═══════════════════════════════════════════════════════════ */
function EntryChecklistForm({ baseTZ, onSuccess, showToast, sessionContract }: {
  baseTZ: string; onSuccess?: () => void; showToast: ShowToast;
  sessionContract?: { type: "day" | "week"; setAt: string } | null;
}) {
  const [isImmediate,  setIsImmediate]  = useState(false);
  /* Always keep 3 datetime slots; show 2 or 3 based on toggle */
  const [dts,          setDts]          = useState<string[]>(() => [
    nowInTZ(baseTZ), nowInTZ(baseTZ), nowInTZ(baseTZ),
  ]);
  const [anchorReason, setAnchorReason] = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [lastErr,      setLastErr]      = useState<string | null>(null);

  /* Immediate: 2 entries [Skip Anchor 1, Target Anchor]
     Not immediate: 3 entries [Skip Anchor 1, Skip Anchor 2, Target Anchor] */
  const count  = isImmediate ? 2 : 3;
  const labels = isImmediate
    ? ["Skip Anchor 1", "Target Anchor"]
    : ["Skip Anchor 1", "Skip Anchor 2", "Target Anchor"];

  function setDt(idx: number, val: string) {
    setDts(prev => prev.map((d, i) => i === idx ? val : d));
  }

  function reset() {
    setIsImmediate(false);
    setDts([nowInTZ(baseTZ), nowInTZ(baseTZ), nowInTZ(baseTZ)]);
    setAnchorReason("");
    setLastErr(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLastErr(null);

    const plan = {
      id:           crypto.randomUUID(),
      immediate:    isImmediate,
      entries:      Array.from({ length: count }, (_, i) => ({
        label:    labels[i],
        datetime: tzLocalToUTC(dts[i], baseTZ),
        anchor:   i === count - 1,   // last entry is always Target Anchor
      })),
      anchor_reason: anchorReason.trim(),
      entry_time:    new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/session/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:    `entry_plan: ${JSON.stringify(plan)}`,
          created_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = j.error ?? `Server error ${res.status}`;
        setLastErr(msg); showToast("error", msg);
      } else {
        showToast("success", "Entry plan submitted");
        reset();
        onSuccess?.();
      }
    } catch {
      const msg = "Network error — plan not saved";
      setLastErr(msg); showToast("error", msg);
    }
    setSubmitting(false);
  }

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3 4h10M3 8h7M3 12h4" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)" }}>Entry Checklist</span>
      </div>

      <form onSubmit={submit} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Session conclude contract violation */}
        {sessionContract && (
          <div style={{
            padding: "10px 14px",
            background: "rgba(240,58,87,0.06)",
            border: "1px solid rgba(240,58,87,0.28)",
            borderLeft: "3px solid var(--red)",
            borderRadius: "0 6px 6px 0",
          }}>
            <p style={{ margin: "0 0 3px", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--red)", textTransform: "uppercase" as const }}>
              ⛔ VIOLATES SESSION CONCLUDE CONTRACT
            </p>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--red)", opacity: 0.85, lineHeight: 1.55 }}>
              Last trade of the {sessionContract.type} was declared.
              Submitting this entry plan violates the session conclude contract.
            </p>
          </div>
        )}

        {/* Immediate checkbox */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }} onClick={() => setIsImmediate(o => !o)}>
            <div style={{
              width: 17, height: 17, borderRadius: 4, flexShrink: 0,
              background: isImmediate ? "rgba(0,204,122,0.2)" : "var(--sub)",
              border: `1.5px solid ${isImmediate ? "rgba(0,204,122,0.6)" : "var(--line-hi)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s, border-color 0.15s",
            }}>
              {isImmediate && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="var(--green)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: isImmediate ? "var(--green)" : "var(--ink-1)", letterSpacing: "-0.01em" }}>
              Immediate
            </span>
            <span style={{ fontSize: 10, color: "var(--ink-3)", fontStyle: "italic" }}>
              {isImmediate ? "2 fields" : "3 fields"}
            </span>
          </div>

          {/* Guide tip — appears on tick */}
          {isImmediate && (
            <div style={{
              marginTop: 8,
              padding: "9px 12px",
              background: "rgba(0,204,122,0.05)",
              border: "1px solid rgba(0,204,122,0.22)",
              borderLeft: "3px solid var(--green)",
              borderRadius: "0 5px 5px 0",
            }}>
              <p style={{ margin: "0 0 3px", fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", color: "var(--green)", textTransform: "uppercase" as const }}>
                ⚡ Immediate anchor guide
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--ink-1)", lineHeight: 1.65 }}>
                Use immediate trend for anchor/n — if <strong style={{ color: "var(--green)" }}>3+ touches on 1 frame higher</strong> exist, use that.
              </p>
            </div>
          )}
        </div>

        {/* Higher frame peak hint — only when not immediate */}
        {!isImmediate && (
          <div style={{
            padding: "8px 12px",
            background: "rgba(77,156,245,0.05)",
            border: "1px solid rgba(77,156,245,0.18)",
            borderLeft: "3px solid #4d9cf5",
            borderRadius: "0 5px 5px 0",
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-1)", lineHeight: 1.6 }}>
              <span style={{ color: "#4d9cf5", fontWeight: 700 }}>↑ Higher frame peak</span>
              {" "}— select anchor from a higher timeframe peak or trough.
            </p>
          </div>
        )}

        {/* Entry datetime fields — always shown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: count }, (_, i) => {
            const isTarget = i === count - 1;
            return (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: 6,
                background: isTarget ? "rgba(0,204,122,0.05)" : "var(--sub)",
                border: `1px solid ${isTarget ? "rgba(0,204,122,0.32)" : "var(--line-hi)"}`,
              }}>
                <div style={{ marginBottom: 7 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: isTarget ? "var(--green)" : "var(--ink-2)" }}>
                    {labels[i]}
                    {isTarget && (
                      <span style={{ marginLeft: 7, fontSize: 9, background: "rgba(0,204,122,0.15)", border: "1px solid rgba(0,204,122,0.3)", borderRadius: 3, padding: "1px 5px", color: "var(--green)", fontWeight: 700 }}>
                        ⚓ ANCHOR
                      </span>
                    )}
                  </span>
                </div>
                <input
                  type="datetime-local" style={INP} value={dts[i]}
                  onChange={e => setDt(i, e.target.value)}
                  onPaste={ev => {
                    const parsed = parseFlexDatetime(ev.clipboardData.getData("text"));
                    if (parsed) { ev.preventDefault(); setDt(i, parsed); }
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Anchor rationale */}
        <div>
          <label style={LBL}>Anchor Choice Rationale</label>
          <textarea
            style={{ ...INP, minHeight: 72, resize: "vertical" }}
            placeholder="Explain why this level is the target anchor…"
            value={anchorReason}
            onChange={e => setAnchorReason(e.target.value)}
          />
        </div>

        {lastErr && (
          <div style={{ display: "flex", gap: 8, padding: "9px 11px", borderRadius: 5, background: "rgba(240,58,87,0.08)", border: "1px solid rgba(240,58,87,0.25)" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="7" stroke="#f03a57" strokeWidth="1.3"/><path d="M8 5v3.5M8 10.5h.01" stroke="#f03a57" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11.5, color: "var(--red)", lineHeight: 1.5 }}>{lastErr}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={reset}
            style={{ flex: 1, padding: "10px 0", borderRadius: 5, background: "var(--sub)", border: "1px solid var(--line-hi)", color: "var(--ink-1)", fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>
            Reset
          </button>
          <button type="submit" disabled={submitting} className="btn btn-primary"
            style={{ flex: 2, padding: "10px 0", fontSize: 12.5, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Submitting…" : "Submit Plan"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FOCUS ALARM
   Operator-only configurable focus/absent cycle alarm.
   Fires a toast + fullscreen flash at (interval - focus) min
   into each cycle so the operator has `focus` min to engage.
═══════════════════════════════════════════════════════════ */

function playAlarmBeeps(volume: number) {
  if (volume <= 0) return;
  try {
    const ctx  = new AudioContext();
    const dest = ctx.destination;
    const v    = Math.min(1, Math.max(0, volume));

    const tone = (t: number, freq: number, dur: number, rel = 1.0) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(v * rel, t + 0.008);
      gain.gain.setValueAtTime(v * rel, t + dur - 0.03);
      gain.gain.linearRampToValueAtTime(0, t + dur);
      osc.start(t); osc.stop(t + dur + 0.01);
    };

    const now = ctx.currentTime;
    tone(now,        1320, 0.08, 0.55);
    tone(now + 0.11, 1320, 0.08, 0.55);
    tone(now + 0.28, 1760, 0.22, 0.65);
    tone(now + 0.70, 1320, 0.08, 0.60);
    tone(now + 0.81, 1320, 0.08, 0.60);
    tone(now + 0.98, 1760, 0.22, 0.70);
    tone(now + 1.40, 1320, 0.08, 0.65);
    tone(now + 1.51, 1320, 0.08, 0.65);
    tone(now + 1.68, 1760, 0.36, 0.75);
    setTimeout(() => ctx.close(), 2500);
  } catch {
    /* AudioContext unavailable */
  }
}

function AnalystToggle({
  showToast, label, subOn, subOff, fetchKey, apiAction, locked, refreshSignal, commentLabel,
}: {
  showToast: ShowToast;
  label: string;
  subOn: string;
  subOff: string;
  fetchKey: string;
  apiAction: string;
  locked?: boolean;
  refreshSignal?: number;
  commentLabel: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchState = useCallback(() => {
    fetch("/api/session/alarm")
      .then(r => r.json())
      .then((s: Record<string, unknown>) => {
        if (typeof s[fetchKey] === "boolean") setEnabled(s[fetchKey] as boolean);
      })
      .catch(() => {});
  }, [fetchKey]);

  useEffect(() => { fetchState(); }, [fetchState]);
  useEffect(() => { if ((refreshSignal ?? 0) > 0) fetchState(); }, [refreshSignal, fetchState]);

  const toggle = async () => {
    if (syncing || locked) return;
    setSyncing(true);
    const next = !enabled;
    setEnabled(next);
    try {
      const r = await fetch("/api/session/alarm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: apiAction }),
      });
      const s = await r.json() as Record<string, unknown>;
      if (typeof s[fetchKey] === "boolean") setEnabled(s[fetchKey] as boolean);
      if (next) {
        const now = new Date().toISOString();
        void fetch("/api/session/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `friction enforce: ${commentLabel}`, created_at: now }),
        });
      }
    } catch {
      setEnabled(!next);
      showToast("error", `Failed to update setting`);
    } finally {
      setSyncing(false);
    }
  };

  const isOn = locked || enabled;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px", borderRadius: 6,
      background: isOn ? "rgba(0,204,122,0.07)" : "var(--sub)",
      outline: `1px solid ${locked ? "rgba(220,60,60,0.4)" : isOn ? "rgba(0,204,122,0.25)" : "var(--line-hi)"}`,
      transition: "background 0.2s, outline-color 0.2s",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: locked ? "var(--red)" : isOn ? "var(--green)" : "var(--ink-1)", letterSpacing: "0.01em" }}>
          {label}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 9.5, color: "var(--ink-4)" }}>
          {locked ? "⚠ System locked — drift threshold breached" : isOn ? subOn : subOff}
        </p>
      </div>
      <button
        type="button"
        disabled={syncing || locked}
        onClick={() => { void toggle(); }}
        aria-label={isOn ? `Disable ${label}` : `Enable ${label}`}
        style={{
          width: 38, height: 22, borderRadius: 11, flexShrink: 0, marginLeft: 10,
          background: isOn ? (locked ? "var(--red)" : "var(--green)") : "var(--raised)",
          border: `1px solid ${locked ? "rgba(220,60,60,0.5)" : "var(--line-hi)"}`,
          cursor: locked ? "not-allowed" : syncing ? "wait" : "pointer",
          position: "relative",
          transition: "background 0.2s",
        }}
      >
        {locked
          ? <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff" }}>🔒</span>
          : <span style={{
              display: "block", width: 16, height: 16, borderRadius: "50%",
              background: isOn ? "#04080F" : "var(--ink-3)",
              position: "absolute", top: 2, left: isOn ? 18 : 2,
              transition: "left 0.2s",
            }} />
        }
      </button>
    </div>
  );
}

function EntryChecklistToggle({ showToast, locked, refreshSignal }: { showToast: ShowToast; locked?: boolean; refreshSignal?: number }) {
  return (
    <AnalystToggle
      showToast={showToast}
      label="Detail anchor log for target SOP"
      subOn="Operator can submit entry plan"
      subOff="Entry checklist hidden from operator"
      fetchKey="entry_checklist_enabled"
      apiAction="toggle_entry_checklist"
      commentLabel="Detail anchor log for target SOP"
      locked={locked}
      refreshSignal={refreshSignal}
    />
  );
}

function AttentionChallengeToggle({ showToast, locked, refreshSignal }: { showToast: ShowToast; locked?: boolean; refreshSignal?: number }) {
  return (
    <AnalystToggle
      showToast={showToast}
      label="Watch challenge to enforce focus"
      subOn="Watch tap challenge active"
      subOff="Tap challenge disabled"
      fetchKey="enforce_focus"
      apiAction="toggle_enforce_focus"
      commentLabel="Watch challenge to enforce focus"
      locked={locked}
      refreshSignal={refreshSignal}
    />
  );
}

function AlarmConfig({ showToast, onRunningChange, isAnalystMode, onChallengeStatusChange, onEntryChecklistEnabledChange }: { showToast: ShowToast; onRunningChange?: (r: boolean) => void; isAnalystMode?: boolean; onChallengeStatusChange?: (status: string | null) => void; onEntryChecklistEnabledChange?: (enabled: boolean) => void }) {
  type SrvState = {
    running:                  boolean;
    started_at:               string | null;
    interval_min:             number;
    focus_min:                number;
    last_ack_cycle:           number;
    enforce_focus:            boolean;
    entry_checklist_enabled:  boolean;
    challenge_number:         number | null;
    challenge_cycle:          number;
    challenge_status:         "pending" | "pass" | "fail" | null;
    challenge_expires_at:     string | null;
  };
  const SRV0: SrvState = {
    running: false, started_at: null, interval_min: 15, focus_min: 2, last_ack_cycle: -1,
    enforce_focus: false, entry_checklist_enabled: false,
    challenge_number: null, challenge_cycle: -1, challenge_status: null, challenge_expires_at: null,
  };

  const [srv,               setSrv]               = useState<SrvState>(SRV0);
  const [intervalMin,       setIntervalMin]       = useState(15);
  const [focusMin,          setFocusMin]          = useState(2);
  const [flash,             setFlash]             = useState(false);
  const [countdown,         setCountdown]         = useState<number | null>(null);
  const [focusRemain,       setFocusRemain]       = useState<number | null>(null);
  const [showSettings,      setShowSettings]      = useState(false);
  const [volume,            setVolume]            = useState(0.7);
  const [syncing,           setSyncing]           = useState(false);
  const [challengeSilenced, setChallengeSilenced] = useState(false);

  const challengeStartedCycle      = useRef(-1); // which cycle we already called challenge_start for
  const challengeResultNotifiedCycle = useRef(-1); // which cycle we already fired pass/fail toast for

  const tickRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundFiredCycle      = useRef<number>(-1);
  const lastAckRef           = useRef<number>(-1);
  const volumeRef            = useRef<number>(0.7);
  const challengeSilencedRef = useRef<boolean>(false);
  useEffect(() => { volumeRef.current           = volume;             }, [volume]);
  useEffect(() => { lastAckRef.current          = srv.last_ack_cycle; }, [srv.last_ack_cycle]);
  useEffect(() => { challengeSilencedRef.current = challengeSilenced;  }, [challengeSilenced]);

  // When toggled to silent mid-session, dismiss any active flash immediately
  useEffect(() => {
    if (!challengeSilenced || !flash || !srv.started_at) return;
    const cycleNum = Math.floor(
      (Date.now() - new Date(srv.started_at).getTime()) / 1000 / (srv.interval_min * 60)
    );
    setFlash(false);
    void callAPI({ action: "ack", cycle: cycleNum });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeSilenced]);

  /* Freeze logic temporarily disabled */

  /* Sync local config from server when alarm is stopped */
  useEffect(() => {
    if (!srv.running) {
      setIntervalMin(srv.interval_min);
      setFocusMin(srv.focus_min);
    }
  }, [srv.running, srv.interval_min, srv.focus_min]);

  /* Notify parent of running state changes */
  useEffect(() => { onRunningChange?.(srv.running); }, [srv.running, onRunningChange]);

  /* Notify parent of challenge status changes */
  useEffect(() => { onChallengeStatusChange?.(srv.challenge_status); }, [srv.challenge_status, onChallengeStatusChange]);

  /* Notify parent of entry checklist enabled state */
  useEffect(() => { onEntryChecklistEnabledChange?.(srv.entry_checklist_enabled); }, [srv.entry_checklist_enabled, onEntryChecklistEnabledChange]);

  /* ── Polling ─────────────────────────────────────── */
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/session/alarm");
      if (res.ok) setSrv(await res.json() as SrvState);
    } catch {}
  }, []);

  useEffect(() => { void fetchState(); }, [fetchState]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchState, srv.running ? 2000 : 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [srv.running, fetchState]);

  /* ── API actions ────────────────────────────────────── */
  const callAPI = useCallback(async (body: Record<string, unknown>) => {
    setSyncing(true);
    try {
      const res = await fetch("/api/session/alarm", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) setSrv(await res.json() as SrvState);
    } catch {} finally { setSyncing(false); }
  }, []);

  /* ── Local countdown + flash detection ─────────────── */
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!srv.running || !srv.started_at) {
      setCountdown(null); setFocusRemain(null); setFlash(false);
      return;
    }
    const epoch      = new Date(srv.started_at).getTime();
    const cycleSec   = srv.interval_min * 60;
    const triggerSec = (srv.interval_min - srv.focus_min) * 60;

    const tick = () => {
      const elapsed       = (Date.now() - epoch) / 1000;
      const cycleNum      = Math.floor(elapsed / cycleSec);
      const cyclePos      = elapsed % cycleSec;

      setCountdown(cyclePos < triggerSec ? Math.ceil(triggerSec - cyclePos) : 0);

      if (cyclePos >= triggerSec) {
        const focusLeft = srv.focus_min * 60 - (cyclePos - triggerSec);
        setFocusRemain(focusLeft > 0 ? Math.ceil(focusLeft) : null);
      } else {
        setFocusRemain(null);
      }

      const inFocusWindow = cyclePos >= triggerSec && cycleNum > lastAckRef.current;
      // Keep flash active while enforce_focus challenge is pending (even after focus window ends)
      const challengeKeepFlash = srv.enforce_focus && srv.challenge_status === "pending";
      // Challenge silenced: no overlay, auto-pass
      const shouldFlash   = !challengeSilencedRef.current && (inFocusWindow || challengeKeepFlash);
      setFlash(shouldFlash);

      if (inFocusWindow && soundFiredCycle.current < cycleNum) {
        soundFiredCycle.current = cycleNum;
        if (challengeSilencedRef.current) {
          // Silent mode: auto-pass the focus window without any alert
          void callAPI({ action: "ack", cycle: cycleNum });
        } else {
          playAlarmBeeps(volumeRef.current);
          showToast("success", "Focus window — return your attention to the session");
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Focus Window", { body: `${srv.focus_min} min — stay present.`, requireInteraction: true });
          }
          // Start enforce_focus challenge: generate number client-side and push to server
          if (srv.enforce_focus && challengeStartedCycle.current < cycleNum) {
            challengeStartedCycle.current = cycleNum;
            const n = Math.floor(Math.random() * 5) + 1;
            void callAPI({ action: "challenge_start", cycle: cycleNum, challengeNumber: n });
          }
        }
      }

      // Auto-dismiss when challenge is resolved — guarded so toast + ack fire exactly once per cycle
      if (srv.enforce_focus) {
        if (srv.challenge_status === "pass" && srv.challenge_cycle === cycleNum) {
          setFlash(false);
          if (challengeResultNotifiedCycle.current !== cycleNum) {
            challengeResultNotifiedCycle.current = cycleNum;
            if (!challengeSilencedRef.current) showToast("success", "Focus challenge passed ✓");
            if (lastAckRef.current < cycleNum) void callAPI({ action: "ack", cycle: cycleNum });
          }
        } else if (srv.challenge_status === "fail" && srv.challenge_cycle === cycleNum) {
          setFlash(false);
          if (challengeResultNotifiedCycle.current !== cycleNum) {
            challengeResultNotifiedCycle.current = cycleNum;
            if (!challengeSilencedRef.current) showToast("error", "Focus challenge failed — fail compliance logged");
          }
        }
      }
    };

    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srv.running, srv.started_at, srv.interval_min, srv.focus_min, srv.enforce_focus, srv.challenge_status, srv.challenge_cycle, showToast, callAPI]);

  const handleStart = useCallback(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default")
      Notification.requestPermission().catch(() => {});
    soundFiredCycle.current              = -1;
    challengeStartedCycle.current        = -1;
    challengeResultNotifiedCycle.current = -1;
    void callAPI({ action: "start", intervalMin, focusMin });
  }, [callAPI, intervalMin, focusMin]);

  const handleStop = useCallback(() => void callAPI({ action: "stop" }), [callAPI]);

  const handleAck = useCallback(() => {
    if (!srv.started_at) { setFlash(false); return; }
    const cycleNum = Math.floor((Date.now() - new Date(srv.started_at).getTime()) / 1000 / (srv.interval_min * 60));
    setFlash(false);
    void callAPI({ action: "ack", cycle: cycleNum });
  }, [callAPI, srv.started_at, srv.interval_min]);

  const handleEnforceToggle = useCallback(() => {
    void callAPI({ action: "toggle_enforce_focus" });
  }, [callAPI]);

  const running      = srv.running;
  const dispInterval = running ? srv.interval_min : intervalMin;
  const dispFocus    = running ? srv.focus_min    : focusMin;

  /* Fire preview */
  const fireMins: number[] = [];
  for (let i = 1; i * dispInterval <= 60; i++) fireMins.push(i * dispInterval - dispFocus);

  function fmtCountdown(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <>
      {/* ── Alarm overlay ── */}
      {flash && (
        <div
          role="alertdialog"
          aria-label="Focus Window Alarm"
          onClick={handleAck}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "var(--canvas)",
            backgroundImage: [
              "radial-gradient(ellipse 80% 55% at 50% 38%, rgba(0,204,122,0.07) 0%, transparent 68%)",
              "radial-gradient(ellipse 44% 32% at 90% 90%, rgba(0,130,255,0.016) 0%, transparent 50%)",
            ].join(","),
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {/* Card */}
          <div
            onClick={e => { e.stopPropagation(); handleAck(); }}
            style={{
              background: "var(--card)",
              backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.026) 0%, transparent 46%)",
              border: "1px solid rgba(0,204,122,0.22)",
              borderRadius: 6,
              padding: "44px 52px 36px",
              display: "flex", flexDirection: "column", alignItems: "center",
              textAlign: "center" as const,
              maxWidth: 420, width: "88%",
              boxShadow: [
                "0 0 0 1px rgba(0,204,122,0.06)",
                "0 20px 56px rgba(0,0,0,0.65)",
                "0 0 80px rgba(0,204,122,0.09)",
              ].join(","),
              animation: "alarmSlideIn 0.32s cubic-bezier(0.4,0,0.2,1) both",
              position: "relative" as const,
              overflow: "hidden",
            }}
          >
            {/* Top accent line */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, var(--green), transparent)",
              animation: "alarmAccent 2.4s ease-in-out infinite",
            }} />

            {/* Custom bell icon with glow halo */}
            <div style={{
              position: "relative", marginBottom: 26,
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 72, height: 72,
            }}>
              {/* Radial glow behind icon */}
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(0,204,122,0.18) 0%, transparent 72%)",
                animation: "alarmGlow 2.2s ease-in-out infinite",
              }} />
              <svg
                width="36" height="36" viewBox="0 0 36 36"
                fill="none" xmlns="http://www.w3.org/2000/svg"
                style={{ position: "relative", zIndex: 1 }}
                aria-hidden
              >
                {/* Handle */}
                <path d="M18 3.5V6" stroke="var(--green)" strokeWidth="1.6" strokeLinecap="round"/>
                {/* Bell body */}
                <path
                  d="M9.5 14.5C9.5 10.358 13.358 7 18 7C22.642 7 26.5 10.358 26.5 14.5V22.5L29 25.5H7L9.5 22.5V14.5Z"
                  stroke="var(--green)" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round"
                  fill="rgba(0,204,122,0.07)"
                />
                {/* Clapper arc */}
                <path
                  d="M14.5 25.5C14.5 27.985 16.015 29.5 18 29.5C19.985 29.5 21.5 27.985 21.5 25.5"
                  stroke="var(--green)" strokeWidth="1.6" strokeLinecap="round"
                />
                {/* Tiny motion lines (ringing) */}
                <path d="M5.5 12.5C5.5 12.5 4 14.5 4 16.5" stroke="var(--green)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
                <path d="M30.5 12.5C30.5 12.5 32 14.5 32 16.5" stroke="var(--green)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
              </svg>
            </div>

            {/* Eyebrow — matches .section-eyebrow */}
            <p style={{
              margin: "0 0 10px",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              color: "var(--green)",
              fontFamily: "var(--font-mono), monospace",
              textShadow: "0 0 22px rgba(0,204,122,0.38)",
            }}>
              Focus Window
            </p>

            {/* Headline */}
            <p style={{
              margin: "0 0 8px",
              fontSize: 20, fontWeight: 700,
              color: "var(--ink-0)", lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}>
              Return Your Attention
            </p>

            {/* Sub-line */}
            <p style={{
              margin: "0 0 28px",
              fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6,
            }}>
              {srv.focus_min}-minute focus window is active.
            </p>

            {/* Divider */}
            <div style={{ width: "100%", height: 1, background: "var(--line)", marginBottom: 24 }} />

            {srv.enforce_focus && srv.challenge_status === "pending" ? (
              /* ── Enforce Focus: show challenge number ── */
              <>
                <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "var(--green)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                  Tap this many times on your watch
                </p>
                <div style={{
                  width: 96, height: 96, borderRadius: "50%",
                  background: "rgba(0,204,122,0.12)",
                  border: "2px solid rgba(0,204,122,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16,
                  boxShadow: "0 0 32px rgba(0,204,122,0.18)",
                }}>
                  <span style={{ fontSize: 52, fontWeight: 800, color: "var(--green)", lineHeight: 1 }}>
                    {srv.challenge_number ?? "…"}
                  </span>
                </div>
                <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--ink-2)" }}>
                  Tap the number on your Galaxy Watch, then submit.
                </p>
                <p style={{ margin: 0, fontSize: 10.5, color: "var(--ink-4)" }}>
                  30-second window · watch is listening…
                </p>
              </>
            ) : (
              /* ── Standard dismiss ── */
              <>
                <button
                  type="button"
                  onClick={handleAck}
                  className="btn btn-primary"
                  style={{ padding: "10px 36px", fontSize: 12.5 }}
                >
                  Acknowledge
                </button>
                <p style={{ margin: "10px 0 0", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.02em" }}>
                  or click anywhere to dismiss
                </p>
              </>
            )}
          </div>

          {/* Subtle screen-edge glow */}
          <div style={{
            position: "fixed", inset: 0, pointerEvents: "none",
            boxShadow: "inset 0 0 48px rgba(0,204,122,0.07)",
            animation: "alarmEdge 2.4s ease-in-out infinite",
          }} />
        </div>
      )}

      <style>{`
        @keyframes alarmSlideIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes alarmGlow {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(1.18); }
        }
        @keyframes alarmAccent {
          0%,100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        @keyframes alarmEdge {
          0%,100% { box-shadow: inset 0 0 48px rgba(0,204,122,0.07); }
          50%      { box-shadow: inset 0 0 80px rgba(0,204,122,0.14); }
        }
      `}</style>

      {/* Config card */}
      <style>{`
        input[type=number].alarm-stepper::-webkit-outer-spin-button,
        input[type=number].alarm-stepper::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number].alarm-stepper { -moz-appearance: textfield; }
      `}</style>
      <div style={{
        marginTop: 12,
        background: "var(--sub)",
        borderRadius: 8,
        outline: `1px solid ${running ? "rgba(0,204,122,0.3)" : "var(--line-hi)"}`,
        transition: "outline-color 0.2s",
        overflow: "hidden",
      }}>

        {/* ── Header row ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderBottom: showSettings ? "1px solid var(--line)" : "none" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-1)", letterSpacing: "0.01em", flex: 1 }}>
            Focus Alarm
          </span>
          {running && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--green)", background: "rgba(0,204,122,0.1)", padding: "2px 7px", borderRadius: 3, letterSpacing: "0.06em" }}>
              ACTIVE
            </span>
          )}
          {/* Challenge mute toggle */}
          <button
            type="button"
            title={challengeSilenced ? "Attention challenge silenced — click to enable" : "Click to silence attention challenge"}
            onClick={() => setChallengeSilenced(s => !s)}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 3, border: "none",
              background: challengeSilenced ? "rgba(255,100,100,0.12)" : "rgba(0,204,122,0.08)",
              color: challengeSilenced ? "#ff6464" : "var(--green)",
              fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em",
              cursor: "pointer", flexShrink: 0,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {challengeSilenced ? (
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M2 2l12 12M6.5 4.5A5 5 0 0 1 13 8.5v2L14.5 12H5M3 8a5 5 0 0 1 .5-2.2M9.5 13.5a1.5 1.5 0 0 1-3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 2.5a5 5 0 0 1 5 5v2l1.5 1.5H1.5L3 9.5v-2a5 5 0 0 1 5-5ZM6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {challengeSilenced ? "SILENT" : "ALERT"}
          </button>
          {/* Gear — toggles settings panel */}
          <button
            type="button"
            aria-label="Toggle alarm settings"
            onClick={() => setShowSettings(s => !s)}
            style={{
              width: 26, height: 26, borderRadius: 5, border: "1px solid var(--line-hi)",
              background: showSettings ? "rgba(0,204,122,0.1)" : "var(--raised)",
              color: showSettings ? "var(--green)" : "var(--ink-2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0, transition: "background 0.15s, color 0.15s",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 10.5A2.5 2.5 0 1 0 8 5.5a2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.929 2.929l1.06 1.06M12.01 12.01l1.06 1.06M2.929 13.071l1.06-1.06M12.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Settings panel (collapsible) ── */}
        {showSettings && (
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Steppers row */}
            <div style={{ display: "flex", gap: 12 }}>
              {([
                { label: "Interval (min)", value: intervalMin, set: (v: number) => setIntervalMin(Math.max(focusMin + 1, Math.min(60, v))), dec: () => setIntervalMin(v => Math.max(focusMin + 1, v - 1)), inc: () => setIntervalMin(v => Math.min(60, v + 1)), decDis: intervalMin <= focusMin + 1, incDis: intervalMin >= 60, min: focusMin + 1, max: 60 },
                { label: "Focus (min)",    value: focusMin,    set: (v: number) => setFocusMin(Math.max(1, Math.min(intervalMin - 1, v))),   dec: () => setFocusMin(v => Math.max(1, v - 1)),               inc: () => setFocusMin(v => Math.min(intervalMin - 1, v + 1)), decDis: focusMin <= 1,             incDis: focusMin >= intervalMin - 1, min: 1, max: intervalMin - 1 },
              ] as const).map(cfg => (
                <div key={cfg.label} style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 5px", fontSize: 9.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                    {cfg.label}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <button type="button" disabled={running || cfg.decDis} onClick={cfg.dec}
                      style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid var(--line-hi)", background: "var(--raised)", color: "var(--ink-1)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", opacity: (running || cfg.decDis) ? 0.3 : 1, flexShrink: 0 }}>
                      −
                    </button>
                    <input type="number" className="alarm-stepper"
                      value={cfg.value} min={cfg.min} max={cfg.max} disabled={running}
                      onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) cfg.set(v); }}
                      style={{ width: 34, fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--ink-0)", background: "transparent", border: "none", borderBottom: `1px solid ${running ? "transparent" : "var(--line-hi)"}`, textAlign: "center" as const, outline: "none", padding: "1px 0", opacity: running ? 0.45 : 1 }}
                    />
                    <button type="button" disabled={running || cfg.incDis} onClick={cfg.inc}
                      style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid var(--line-hi)", background: "var(--raised)", color: "var(--ink-1)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", opacity: (running || cfg.incDis) ? 0.3 : 1, flexShrink: 0 }}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Fire preview */}
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 9.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                Fires at (per hour)
              </p>
              <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)" }}>
                {fireMins.map(m => `${m}m`).join(" · ")}
              </p>
            </div>

            {/* Volume slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <p style={{ margin: 0, fontSize: 9.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>Volume</p>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-2)", fontWeight: 600 }}>
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <input
                type="range" min={0} max={1} step={0.05} value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "var(--green)" }}
              />
            </div>

            {/* Enforce Focus toggle — analyst session only */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 10px", borderRadius: 6,
              background: srv.enforce_focus ? "rgba(0,204,122,0.06)" : "var(--card)",
              border: `1px solid ${srv.enforce_focus ? "rgba(0,204,122,0.25)" : "var(--line)"}`,
              opacity: isAnalystMode ? 1 : 0.4,
              transition: "background 0.2s, border-color 0.2s",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: srv.enforce_focus ? "var(--green)" : "var(--ink-1)", letterSpacing: "0.01em" }}>
                  Enforce Focus
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 9.5, color: "var(--ink-4)" }}>
                  {isAnalystMode ? "Tap challenge on watch to acknowledge" : "Analyst session only"}
                </p>
              </div>
              <button
                type="button"
                disabled={!isAnalystMode || syncing}
                onClick={handleEnforceToggle}
                aria-label={srv.enforce_focus ? "Disable enforce focus" : "Enable enforce focus"}
                style={{
                  width: 38, height: 22, borderRadius: 11,
                  background: srv.enforce_focus ? "var(--green)" : "var(--raised)",
                  border: "1px solid var(--line-hi)",
                  cursor: isAnalystMode ? "pointer" : "not-allowed",
                  position: "relative", flexShrink: 0,
                  transition: "background 0.2s",
                }}
              >
                <span style={{
                  display: "block", width: 16, height: 16, borderRadius: "50%",
                  background: srv.enforce_focus ? "#04080F" : "var(--ink-3)",
                  position: "absolute", top: 2,
                  left: srv.enforce_focus ? 18 : 2,
                  transition: "left 0.2s",
                }} />
              </button>
            </div>
          </div>
        )}

        {/* ── Always-visible body ── */}
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>


          {/* Dual countdown tiles */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              flex: 1, padding: "7px 10px", borderRadius: 5,
              background: running ? "var(--raised)" : "var(--card)",
              border: `1px solid ${isAnalystMode ? "rgba(240,160,48,0.18)" : running && countdown !== null && countdown < 60 ? "rgba(0,204,122,0.25)" : "var(--line)"}`,
              transition: "border-color 0.3s",
            }}>
              <p style={{ margin: "0 0 1px", fontSize: 9.5, fontWeight: 600, color: isAnalystMode ? "var(--amber)" : "var(--ink-3)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>Next Alarm</p>
              <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: isAnalystMode ? "var(--amber)" : running && countdown !== null && countdown < 60 ? "var(--green)" : running ? "var(--ink-1)" : "var(--ink-3)" }}>
                {running && countdown !== null ? fmtCountdown(countdown) : `${dispInterval - dispFocus}:00`}
              </p>
            </div>
            <div style={{
              flex: 1, padding: "7px 10px", borderRadius: 5,
              background: focusRemain ? "rgba(0,204,122,0.04)" : "var(--card)",
              border: `1px solid ${focusRemain ? "rgba(0,204,122,0.18)" : "var(--line)"}`,
              transition: "background 0.3s, border-color 0.3s",
            }}>
              <p style={{ margin: "0 0 1px", fontSize: 9.5, fontWeight: 600, color: focusRemain ? "var(--green)" : "var(--ink-3)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>Focus Left</p>
              <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: focusRemain ? "var(--ink-1)" : "var(--ink-3)" }}>
                {focusRemain ? fmtCountdown(focusRemain) : `${dispFocus}:00`}
              </p>
            </div>
          </div>

          {/* Start / Stop */}
          <button
            type="button"
            disabled={syncing}
            onClick={running ? handleStop : handleStart}
            style={{
              width: "100%", padding: "9px 0", borderRadius: 6, border: "none",
              background: running ? "rgba(240,58,87,0.1)" : "rgba(0,204,122,0.1)",
              color: running ? "var(--red)" : "var(--green)",
              outline: `1px solid ${running ? "rgba(240,58,87,0.28)" : "rgba(0,204,122,0.22)"}`,
              fontSize: 12.5, fontWeight: 700, cursor: syncing ? "wait" : "pointer",
              transition: "background 0.15s, color 0.15s, outline-color 0.15s",
              letterSpacing: "0.02em", opacity: syncing ? 0.6 : 1,
            }}
          >
            {syncing ? "Syncing…" : running ? "Stop Alarm" : "Start Alarm"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   SESSION COUNTDOWN
   hero=true  → operator standby gets a large centred clock
   hero=false → compact strip used everywhere else
═══════════════════════════════════════════════════════════ */
function SessionCountdown({ hero = false }: { hero?: boolean }) {
  const [status, setStatus] = useState<SessionStatus | null>(null);

  useEffect(() => {
    setStatus(getSessionStatus());
    const id = setInterval(() => setStatus(getSessionStatus()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const { inSession, sessionName, targetLabel, remainingSec } = status;
  const accent = inSession ? "var(--green)" : "var(--blue)";
  const bg     = inSession ? "var(--green-06)" : "rgba(77,156,245,0.05)";
  const border = inSession ? "rgba(0,204,122,0.22)" : "rgba(77,156,245,0.18)";

  /* ── Hero layout: operator standby only ─────────────── */
  if (hero && !inSession) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 20, padding: "52px 24px",
        borderRadius: 8,
        background: "rgba(77,156,245,0.04)",
        border: "1px solid rgba(77,156,245,0.14)",
        textAlign: "center",
      }}>
        {/* Status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--blue)",
            boxShadow: "0 0 0 4px rgba(77,156,245,0.14)",
          }} />
          <span className="mono" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase" as const, color: "var(--blue)",
          }}>Standby</span>
        </div>

        {/* Session label */}
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", letterSpacing: "0.01em" }}>
          {sessionName}
          <span style={{ color: "var(--ink-3)", marginLeft: 8 }}>· starts at {targetLabel}</span>
        </p>

        {/* Giant clock */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase" as const, color: "var(--ink-3)",
          }}>starts in</span>
          <span className="mono" style={{
            fontSize: "clamp(52px, 10vw, 80px)",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--blue)",
            lineHeight: 1,
            textShadow: "0 0 40px rgba(77,156,245,0.35)",
          }}>
            {fmtHMS(remainingSec)}
          </span>
        </div>
      </div>
    );
  }

  /* ── Compact layout: all other states ───────────────── */
  return (
    <div className="session-countdown-wrap" style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 20px", borderRadius: 6,
      background: bg, border: `1px solid ${border}`,
    }}>
      {/* Left — session info */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
          background: accent,
          boxShadow: inSession ? `0 0 0 3px rgba(0,204,122,0.18)` : "none",
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p className="section-eyebrow" style={{ color: "var(--amber)", marginBottom: 5 }}>Pre-Session Mirror</p>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--ink-0)", letterSpacing: "-0.02em" }}>
            {f.state.mode}
          </p>
        </div>
        {f.ts && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
            padding: "4px 9px", borderRadius: 4,
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)",
          }}>
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden style={{ flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4.5" stroke="var(--ink-3)" strokeWidth="1.2"/>
              <path d="M6 3.5V6l1.5 1.5" stroke="var(--ink-3)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--ink-3)", letterSpacing: "0.02em" }}>
              {f.ts}
            </span>
          </div>
        )}
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
  const [greeting,      setGreeting]      = useState("Welcome back");
  const [timeStr,       setTimeStr]       = useState("");
  const [dayStr,        setDayStr]        = useState("");
  const [alarmRunning,      setAlarmRunning]      = useState(false);
  const [challengeStatus,   setChallengeStatus]   = useState<string | null>(null);
  const [baseTZ,       setBaseTZ]       = useState<string>(() => {
    if (typeof window === "undefined") return "Australia/Melbourne";
    return localStorage.getItem("xtnl_tz") ?? "Australia/Melbourne";
  });
  const handleTZChange = useCallback((tz: string) => {
    setBaseTZ(tz);
    if (typeof window !== "undefined") localStorage.setItem("xtnl_tz", tz);
  }, []);
  const [selId,          setSelId]          = useState<string | null>(null);
  const [hydrateValues,  setHydrateValues]  = useState<TradeHydrate | null>(null);
  const [showChecklist,  setShowChecklist]  = useState(false);
  const [opMainView,     setOpMainView]     = useState<"mirror" | "journal">("mirror");
  const [frictionReport, setFrictionReport] = useState<FrictionReport | null>(null);

  /* ── Fetch audit report from OneDrive ──────────────── */
  const auditWeekKeyRef = useRef<string>("");

  const fetchAuditReport = useCallback(async () => {
    try {
      const r = await fetch("/api/session/audit-report");
      if (!r.ok) return;
      const weekKey = r.headers.get("X-Week-Key") ?? getMondayAESTKey();
      const text    = await r.text();
      auditWeekKeyRef.current = weekKey;
      setFrictionReport(parseFrictionReport(text));
    } catch { /* silently ignore — report may not exist yet */ }
  }, []);

  useEffect(() => { void fetchAuditReport(); }, [fetchAuditReport]);

  /* ── Live update when Analysis Session is confirmed ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const raw = (e as CustomEvent<string>).detail;
      if (raw) {
        auditWeekKeyRef.current = getMondayAESTKey();
        setFrictionReport(parseFrictionReport(raw));
      }
    };
    window.addEventListener("audit-report-ready", handler);
    return () => window.removeEventListener("audit-report-ready", handler);
  }, []);

  /* ── Auto-refresh Monday 4 AM AEST ───────────────────── */
  useEffect(() => {
    const check = () => {
      if (getMondayAESTKey() !== auditWeekKeyRef.current) void fetchAuditReport();
    };
    const id = setInterval(check, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [fetchAuditReport]);

  /* ── Drift-threshold enforcement ────────────────────
     If capture < 40% OR efficiency rating < 0.65, both
     functions are auto-enabled and locked against analyst override.
  ─────────────────────────────────────────────────── */
  const isDriftAlert = frictionReport
    ? frictionReport.exec.capture < 40 || frictionReport.exec.rating < 0.65
    : false;

  const driftAutoTriggeredRef  = useRef(false);
  const [driftRefreshSignal, setDriftRefreshSignal] = useState(0);

  useEffect(() => {
    if (!isDriftAlert) { driftAutoTriggeredRef.current = false; return; }
    if (driftAutoTriggeredRef.current) return;
    driftAutoTriggeredRef.current = true;

    void (async () => {
      try {
        const stateRes = await fetch("/api/session/alarm");
        const s = await stateRes.json() as { entry_checklist_enabled?: boolean; enforce_focus?: boolean };
        const now = new Date().toISOString();

        if (!s.entry_checklist_enabled) {
          await fetch("/api/session/alarm", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "toggle_entry_checklist" }),
          });
          await fetch("/api/session/comments", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "customer automatic trigger: Detail anchor log for target SOP", created_at: now }),
          });
        }
        if (!s.enforce_focus) {
          await fetch("/api/session/alarm", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "toggle_enforce_focus" }),
          });
          await fetch("/api/session/comments", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "customer automatic trigger: Watch challenge to enforce focus", created_at: new Date().toISOString() }),
          });
        }
        setDriftRefreshSignal(n => n + 1);
      } catch { /* silent — non-blocking */ }
    })();
  }, [isDriftAlert]);

  /* ── Toast notifications ─────────────────────────── */
  const [toasts,   setToasts]  = useState<ToastMsg[]>([]);
  const toastId = useRef(0);
  const showToast = useCallback<ShowToast>((kind, text) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, kind, text }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3800);
  }, []);

  /* ── Supabase data state ─────────────────────────── */
  const [optimalRows,  setOptimalRows]  = useState<OptimalRow[]>([]);
  const [liveRows,     setLiveRows]     = useState<LiveRow[]>([]);
  const [commentRows,  setCommentRows]  = useState<CommentRow[]>([]);
  const [loadingOpt,   setLoadingOpt]   = useState(true);
  const [loadingLive,  setLoadingLive]  = useState(true);
  const [loadingComm,  setLoadingComm]  = useState(true);

  /* ── Session pipeline status ─────────────────────── */
  const [pipelineStatus,    setPipelineStatus]    = useState<{ ingestionDone: boolean; processDone: boolean } | null>(null);
  const [analysisDone,      setAnalysisDone]      = useState(false);
  const [analysisChecking,  setAnalysisChecking]  = useState(false);

  /* Derived pipeline progress — computed from already-loaded liveRows, always in sync */
  const pipeTotalLive     = liveRows.length;
  const pipeProcessedLive = liveRows.filter(isTradeProcessed).length;
  const pipeIngestionDone = pipeTotalLive > 0;
  const pipeProcessDone   = pipeIngestionDone && pipeProcessedLive === pipeTotalLive;
  const pipeProgress      = pipeTotalLive > 0 ? pipeProcessedLive / pipeTotalLive : 0;

  const fetchOptimal = useCallback(async () => {
    setLoadingOpt(true);
    try { const r = await fetch("/api/session/optimal-trades"); const j = await r.json(); setOptimalRows(j.rows ?? []); } catch {}
    setLoadingOpt(false);
  }, []);

  const deleteOptimal = useCallback(async (id: string) => {
    const res = await fetch("/api/session/optimal-trades", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setOptimalRows(prev => prev.filter(r => r.optimal_trade_id !== id));
      showToast("success", "Trade deleted");
    } else {
      const j = await res.json().catch(() => ({}));
      showToast("error", j.error ?? "Delete failed");
    }
  }, [showToast]);

  const deleteComment = useCallback(async (createdAt: string) => {
    const res = await fetch("/api/session/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ created_at: createdAt }),
    });
    if (res.ok) {
      setCommentRows(prev => prev.filter(r => r.created_at !== createdAt));
      showToast("success", "Comment deleted");
    } else {
      const j = await res.json().catch(() => ({}));
      showToast("error", j.error ?? "Delete failed");
    }
  }, [showToast]);

  const fetchPipelineStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/session/pipeline-status");
      if (r.ok) { const j = await r.json(); setPipelineStatus(j); }
    } catch { /* ignore */ }
  }, []);

  const fetchLive = useCallback(async () => {
    setLoadingLive(true);
    try { const r = await fetch("/api/session/live-trades"); const j = await r.json(); setLiveRows(j.rows ?? []); } catch {}
    setLoadingLive(false);
    fetchPipelineStatus();
  }, [fetchPipelineStatus]);

  const fetchComments = useCallback(async () => {
    setLoadingComm(true);
    try { const r = await fetch("/api/session/comments"); const j = await r.json(); setCommentRows(j.rows ?? []); } catch {}
    setLoadingComm(false);
  }, []);

  const fetchJournal = useCallback(() => { fetchOptimal(); fetchComments(); }, [fetchOptimal, fetchComments]);

  const handleVerifyAnalysis = useCallback(async () => {
    setAnalysisChecking(true);
    try {
      const r = await fetch("/api/data/report");
      if (r.ok) {
        setAnalysisDone(true);
        showToast("success", "Weekly report found — Analysis Session verified");
      } else {
        showToast("error", "No weekly report found in OneDrive yet");
      }
    } catch {
      showToast("error", "Could not reach OneDrive — try again");
    }
    setAnalysisChecking(false);
  }, [showToast]);

  useEffect(() => {
    fetchOptimal();
    fetchLive();
    fetchComments();
    fetchPipelineStatus();
  }, [fetchOptimal, fetchLive, fetchComments, fetchPipelineStatus]);

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
  const effectiveMode: Mode = IS_DEV && modeOverride !== null ? modeOverride : mode;
  // Precompute as plain boolean — TypeScript control-flow narrows effectiveMode to
  // "operator" inside the operator JSX block, making in-JSX comparisons fail tsc.
  const isAnalystMode: boolean = effectiveMode === "analyst";

  /* Look up the trade_id UUID from the selected optimal row to pre-fill forms */
  const selectedTradeId = selId
    ? (optimalRows.find(t => t.optimal_trade_id === selId)?.trade_id ?? selId)
    : undefined;
  const modeColor = effectiveMode === "analyst" ? "var(--amber)" : "var(--green)";

  /* Derive the active session conclude contract from comments */
  let sessionContract: { type: "day" | "week"; setAt: string } | null = null;
  for (const c of [...commentRows].sort((a, b) => new Date(b.Entry).getTime() - new Date(a.Entry).getTime())) {
    if (c.content.startsWith("session_contract:")) {
      try {
        const p = JSON.parse(c.content.replace(/^session_contract:/, "")) as { type: "day" | "week"; setAt: string };
        if (isContractActive(p)) sessionContract = p;
      } catch {}
      break; // only the most recent contract matters
    }
  }

  return (
    <div style={{ minHeight: "100%", paddingBottom: 64 }}>
      <Toaster toasts={toasts} />
      <div className="site-container" style={{ paddingTop: 20 }}>

        {/* ── PAGE HEADER ──────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: "clamp(18px, 2.5vw, 22px)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink-0)" }}>{greeting}</h1>
              {alarmRunning && effectiveMode === "operator" && (
                <span
                  title="Focus alarm active"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 28, height: 28, borderRadius: "50%",
                    background: "rgba(0,204,122,0.12)",
                    border: "1px solid rgba(0,204,122,0.3)",
                    color: "var(--green)",
                    animation: "alarmBadgePulse 2s ease-in-out infinite",
                    flexShrink: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 36 36" fill="none" aria-hidden>
                    <path d="M18 3.5V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M9.5 14.5C9.5 10.358 13.358 7 18 7C22.642 7 26.5 10.358 26.5 14.5V22.5L29 25.5H7L9.5 22.5V14.5Z"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                      fill="rgba(0,204,122,0.12)"/>
                    <path d="M14.5 25.5C14.5 27.985 16.015 29.5 18 29.5C19.985 29.5 21.5 27.985 21.5 25.5"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </span>
              )}
              <style>{`
                @keyframes alarmBadgePulse {
                  0%,100% { box-shadow: 0 0 0 0 rgba(0,204,122,0.45); opacity: 1; }
                  50%      { box-shadow: 0 0 0 6px rgba(0,204,122,0);  opacity: 0.75; }
                }
              `}</style>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 5, flexWrap: "wrap" }}>
              {timeStr && <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>Melbourne · {dayStr} · {timeStr} AEST</span>}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase" }}>TZ</span>
                <select
                  value={baseTZ}
                  onChange={e => handleTZChange(e.target.value)}
                  style={{
                    background: "var(--sub)", border: "1px solid var(--line-hi)", borderRadius: 4,
                    color: "var(--ink-2)", fontSize: 10.5, fontFamily: "var(--font-mono)",
                    padding: "3px 6px", cursor: "pointer", outline: "none",
                  }}
                >
                  {TIMEZONES.map(z => (
                    <option key={z.value} value={z.value}>{z.label}  {tzOffset(z.value)}</option>
                  ))}
                </select>
                <span suppressHydrationWarning style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
                  {nowInTZ(baseTZ).replace("T", " ")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SESSION COUNTDOWN ────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <SessionCountdown hero={effectiveMode === "operator"} />
        </div>

        {/* ════════════════════════════════════════════════════
            ANALYST MODE
        ════════════════════════════════════════════════════ */}
        {effectiveMode === "analyst" && (
          <div className="session-2col">
            <div className="session-main">
              <OptimalTable rows={optimalRows} loading={loadingOpt} selected={selId} onSelect={id => setSelId(prev => prev === id ? null : id)} tz={baseTZ} onDelete={deleteOptimal} onRefresh={fetchOptimal} />
              <LiveTable tz={baseTZ} isAnalyst={effectiveMode === "analyst"} onRefresh={fetchLive} onHydrate={v => setHydrateValues({ ...v })} />
              <JournalTimeline trades={optimalRows} tradingLoading={loadingOpt} comments={commentRows} commentsLoading={loadingComm} tz={baseTZ} analystMode={effectiveMode === "analyst"} liveRows={liveRows} onDeleteComment={deleteComment} onRefresh={fetchJournal} />
            </div>
            <div className="session-sidebar session-sidebar-340">
              <RecordTradeForm selectedId={selId} hydrate={hydrateValues} onSuccess={fetchOptimal} showToast={showToast} baseTZ={baseTZ} />

              <EntryChecklistToggle showToast={showToast} locked={isDriftAlert} refreshSignal={driftRefreshSignal} />
              <AttentionChallengeToggle showToast={showToast} locked={isDriftAlert} refreshSignal={driftRefreshSignal} />

              <AddCommentForm tradeId={selectedTradeId ?? undefined} isAnalyst failCompliance={challengeStatus === "fail"} onSuccess={fetchJournal} showToast={showToast} baseTZ={baseTZ} />

              {/* ── DEBUG: Alarm & challenge block — remove in subsequent version ── */}
              <div style={{ border: "1px dashed rgba(240,160,32,0.45)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 11px",
                  background: "rgba(240,160,32,0.07)",
                  borderBottom: "1px dashed rgba(240,160,32,0.25)",
                }}>
                  <span style={{ fontSize: 8.5, fontWeight: 800, color: "var(--amber)", letterSpacing: "0.1em" }}>⚙ DEBUG</span>
                  <span style={{ fontSize: 8.5, color: "var(--ink-4)" }}>Alarm &amp; challenge · removed next version</span>
                </div>
                <AlarmConfig showToast={showToast} onRunningChange={setAlarmRunning} isAnalystMode={isAnalystMode} onChallengeStatusChange={setChallengeStatus} />
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            OPERATOR MODE
        ════════════════════════════════════════════════════ */}
        {effectiveMode === "operator" && (
          <div className="session-2col">

            {/* ── Main panel ── */}
            <div className="session-main">

              {/* Tab strip */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--line)", marginBottom: 28 }}>
                {(["mirror", "journal"] as const).map(view => {
                  const active = opMainView === view;
                  return (
                    <button key={view} type="button" onClick={() => setOpMainView(view)} style={{
                      padding: "9px 20px", border: "none", background: "none",
                      borderBottom: `2px solid ${active ? "var(--green)" : "transparent"}`,
                      marginBottom: -1,
                      color: active ? "var(--ink-0)" : "var(--ink-3)",
                      fontSize: 12.5, fontWeight: active ? 700 : 400,
                      letterSpacing: "0.015em", cursor: "pointer",
                      transition: "color 0.15s, border-color 0.15s",
                    }}>
                      {view === "mirror" ? "Mirror · LLM Audit" : "Session Journal"}
                    </button>
                  );
                })}
              </div>

              {opMainView === "mirror"  && (
                frictionReport
                  ? <FrictionPanel f={frictionReport} />
                  : <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                      Loading audit report…
                    </div>
              )}
              {opMainView === "journal" && (
                <JournalTimeline
                  trades={optimalRows} tradingLoading={loadingOpt}
                  comments={commentRows} commentsLoading={loadingComm}
                  tz={baseTZ} operatorView onRefresh={fetchJournal}
                />
              )}
            </div>

            {/* ── Sidebar: always visible regardless of main tab ── */}
            <div className="session-sidebar session-sidebar-340">

              {/* Entry Checklist — shown when analyst has enabled it; operator cannot toggle */}
              {showChecklist && (
                <EntryChecklistForm baseTZ={baseTZ} onSuccess={fetchComments} showToast={showToast} sessionContract={sessionContract} />
              )}

              <AddCommentForm fullWidth failCompliance={challengeStatus === "fail"} onSuccess={fetchComments} showToast={showToast} baseTZ={baseTZ} />

              <AlarmConfig showToast={showToast} onRunningChange={setAlarmRunning} isAnalystMode={isAnalystMode} onChallengeStatusChange={setChallengeStatus} onEntryChecklistEnabledChange={setShowChecklist} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
