"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface Props {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  required?: boolean;
}

const DAYS  = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function pad(n: number) { return String(n).padStart(2, "0"); }

function parseVal(v: string) {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return { year: +m[1], month: +m[2] - 1, day: +m[3], hour: +m[4], minute: +m[5] };
}

function toVal(y: number, mo: number, d: number, h: number, mi: number) {
  return `${y}-${pad(mo + 1)}-${pad(d)}T${pad(h)}:${pad(mi)}`;
}

function fmtDisplay(v: string) {
  const p = parseVal(v);
  if (!p) return "Select date & time";
  const date = new Date(p.year, p.month, p.day);
  const ds = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const h12 = p.hour % 12 || 12;
  const ampm = p.hour < 12 ? "AM" : "PM";
  return `${ds} · ${pad(h12)}:${pad(p.minute)} ${ampm}`;
}

export function DatetimePicker({ value, onChange, style, required }: Props) {
  const [open,     setOpen]     = useState(false);
  const [pos,      setPos]      = useState({ top: 0, left: 0 });
  const [viewYear, setViewYear] = useState(() => parseVal(value)?.year  ?? new Date().getFullYear());
  const [viewMon,  setViewMon]  = useState(() => parseVal(value)?.month ?? new Date().getMonth());

  const trigRef = useRef<HTMLButtonElement>(null);
  const panRef  = useRef<HTMLDivElement>(null);

  const parsed = parseVal(value);
  const h12    = parsed ? (parsed.hour % 12 || 12) : 12;
  const ampm   = parsed ? (parsed.hour < 12 ? "AM" : "PM") : "AM";

  const openPicker = useCallback(() => {
    if (!trigRef.current) return;
    const r = trigRef.current.getBoundingClientRect();
    const panelH = 340;
    const below  = r.bottom + 8;
    const above  = r.top - 8 - panelH;
    setPos({ top: below + panelH > window.innerHeight && above > 0 ? above : below, left: r.left });
    if (parsed) { setViewYear(parsed.year); setViewMon(parsed.month); }
    setOpen(true);
  }, [parsed]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (!panRef.current?.contains(e.target as Node) && !trigRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const cells = () => {
    const first = new Date(viewYear, viewMon, 1);
    let dow = first.getDay();
    dow = dow === 0 ? 6 : dow - 1;
    const dim  = new Date(viewYear, viewMon + 1, 0).getDate();
    const dimp = new Date(viewYear, viewMon,     0).getDate();
    const out: { y: number; mo: number; d: number; cur: boolean }[] = [];
    for (let i = 0; i < dow; i++)
      out.push({ y: viewMon === 0 ? viewYear - 1 : viewYear, mo: viewMon === 0 ? 11 : viewMon - 1, d: dimp - dow + 1 + i, cur: false });
    for (let d = 1; d <= dim; d++)
      out.push({ y: viewYear, mo: viewMon, d, cur: true });
    let nx = 1;
    while (out.length % 7 !== 0)
      out.push({ y: viewMon === 11 ? viewYear + 1 : viewYear, mo: viewMon === 11 ? 0 : viewMon + 1, d: nx++, cur: false });
    return out;
  };

  const pickDay = (y: number, mo: number, d: number) =>
    onChange(toVal(y, mo, d, parsed?.hour ?? 0, parsed?.minute ?? 0));

  const setHour = (h: number) => parsed && onChange(toVal(parsed.year, parsed.month, parsed.day, h, parsed.minute));
  const setMin  = (mi: number) => parsed && onChange(toVal(parsed.year, parsed.month, parsed.day, parsed.hour, mi));

  const isSel = (y: number, mo: number, d: number) =>
    parsed?.year === y && parsed?.month === mo && parsed?.day === d;
  const isToday = (y: number, mo: number, d: number) => {
    const t = new Date();
    return t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d;
  };

  const prevMon = () => viewMon === 0  ? (setViewMon(11), setViewYear(y => y - 1)) : setViewMon(m => m - 1);
  const nextMon = () => viewMon === 11 ? (setViewMon(0),  setViewYear(y => y + 1)) : setViewMon(m => m + 1);

  const hasValue = !!parsed;

  return (
    <>
      <button
        ref={trigRef}
        type="button"
        aria-required={required}
        onClick={open ? () => setOpen(false) : openPicker}
        style={{
          width: "100%", textAlign: "left", boxSizing: "border-box",
          background: "var(--sub)", border: "1px solid var(--line-hi)",
          borderRadius: 5, padding: "9px 11px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", fontFamily: "inherit", gap: 8,
          ...style,
        }}
      >
        <span style={{
          fontSize: 12.5,
          color: hasValue ? "var(--ink-0)" : "var(--ink-3)",
          fontFamily: "var(--font-mono, monospace)",
          letterSpacing: "0.01em",
        }}>
          {fmtDisplay(value)}
        </span>
        {/* Calendar icon */}
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "var(--ink-2)", opacity: 0.7 }}>
          <rect x="2" y="4" width="12" height="10" rx="1.8" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M5 2v3M11 2v3M2 7.5h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </button>

      {open && typeof window !== "undefined" && createPortal(
        <div
          ref={panRef}
          style={{
            position: "fixed", top: pos.top, left: pos.left,
            zIndex: 99999, width: 288,
            background: "#070d18",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 10,
            boxShadow: "0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,204,122,0.06)",
            fontFamily: "inherit", overflow: "hidden",
          }}
        >
          {/* ── Month header ───────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", padding: "13px 14px 8px", gap: 6 }}>
            <button type="button" onClick={prevMon} style={S.navBtn}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M6.5 2L3.5 5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--ink-0)", letterSpacing: "0.02em" }}>
              {MONTHS[viewMon]} {viewYear}
            </span>
            <button type="button" onClick={nextMon} style={S.navBtn}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3.5 2L6.5 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* ── Day-of-week headers ─────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "0 10px 4px" }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "rgba(90,116,144,0.8)", letterSpacing: "0.05em", padding: "2px 0" }}>
                {d}
              </div>
            ))}
          </div>

          {/* ── Calendar grid ───────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "0 10px 10px", gap: "2px 1px" }}>
            {cells().map((c, i) => {
              const sel = isSel(c.y, c.mo, c.d);
              const tod = isToday(c.y, c.mo, c.d);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDay(c.y, c.mo, c.d)}
                  style={{
                    textAlign: "center", padding: "5px 0", borderRadius: 5,
                    fontSize: 11.5, fontWeight: sel ? 700 : 400,
                    cursor: "pointer", border: "none",
                    background: sel
                      ? "var(--green)"
                      : tod ? "rgba(0,204,122,0.07)" : "transparent",
                    color: sel
                      ? "#020508"
                      : !c.cur ? "rgba(90,116,144,0.4)"
                      : tod  ? "var(--green)" : "var(--ink-1)",
                    outline: tod && !sel ? "1px solid rgba(0,204,122,0.28)" : "none",
                    outlineOffset: -1,
                    transition: "background 120ms, color 120ms",
                  }}
                >
                  {c.d}
                </button>
              );
            })}
          </div>

          {/* ── Divider ─────────────────────────────────────── */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 10px" }} />

          {/* ── Time row ────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 8 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(90,116,144,0.8)", letterSpacing: "0.06em", textTransform: "uppercase" as const, flex: 1 }}>
              Time
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number" min={1} max={12} value={h12}
                onChange={e => {
                  const v = Math.max(1, Math.min(12, parseInt(e.target.value) || 1));
                  setHour(ampm === "AM" ? (v === 12 ? 0 : v) : (v === 12 ? 12 : v + 12));
                }}
                style={S.timeInp}
              />
              <span style={{ color: "rgba(90,116,144,0.6)", fontWeight: 700, fontSize: 13 }}>:</span>
              <input
                type="number" min={0} max={59} value={pad(parsed?.minute ?? 0)}
                onChange={e => {
                  const v = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                  setMin(v);
                }}
                style={S.timeInp}
              />
              <button
                type="button"
                onClick={() => parsed && setHour(parsed.hour < 12 ? parsed.hour + 12 : parsed.hour - 12)}
                style={{
                  padding: "4px 9px", borderRadius: 5, fontSize: 10.5, fontWeight: 700,
                  background: "rgba(0,204,122,0.10)", border: "1px solid rgba(0,204,122,0.22)",
                  color: "var(--green)", cursor: "pointer", letterSpacing: "0.04em",
                  transition: "background 120ms",
                }}
              >
                {ampm}
              </button>
            </div>
          </div>

          {/* ── Footer actions ──────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px 10px", borderTop: "1px solid rgba(255,255,255,0.05)", gap: 6 }}>
            <button type="button" onClick={() => onChange("")} style={S.ghostBtn}>Clear</button>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => {
              const n = new Date();
              onChange(toVal(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes()));
            }} style={S.ghostBtn}>Now</button>
            <button type="button" onClick={() => setOpen(false)} style={S.doneBtn}>Done</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

const S = {
  navBtn: {
    background: "none", border: "none", cursor: "pointer",
    padding: "5px 7px", borderRadius: 5,
    color: "var(--ink-2)", display: "flex", alignItems: "center",
    transition: "background 120ms",
  } as React.CSSProperties,

  timeInp: {
    width: 38, textAlign: "center" as const,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 5, padding: "4px 4px", fontSize: 13,
    color: "var(--ink-0)", outline: "none",
    fontFamily: "var(--font-mono, monospace)",
  } as React.CSSProperties,

  ghostBtn: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 11, color: "var(--ink-2)", padding: "4px 8px",
    borderRadius: 5, fontFamily: "inherit",
    transition: "color 120ms",
  } as React.CSSProperties,

  doneBtn: {
    background: "rgba(0,204,122,0.12)", border: "1px solid rgba(0,204,122,0.25)",
    cursor: "pointer", fontSize: 11, color: "var(--green)", padding: "4px 12px",
    borderRadius: 5, fontFamily: "inherit", fontWeight: 600,
    letterSpacing: "0.02em", transition: "background 120ms",
  } as React.CSSProperties,
};
