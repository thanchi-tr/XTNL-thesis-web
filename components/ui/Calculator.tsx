"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

type CalcOp = "+" | "−" | "×" | "÷" | null;

function compute(a: number, op: CalcOp, b: number): number {
  if (op === "+") return a + b;
  if (op === "−") return a - b;
  if (op === "×") return a * b;
  if (op === "÷") return b === 0 ? NaN : a / b;
  return b;
}

function fmtNum(n: number): string {
  if (isNaN(n))    return "Not a number";
  if (!isFinite(n)) return "Overflow";
  return parseFloat(n.toPrecision(12)).toString();
}

const BTN_BASE: React.CSSProperties = {
  border: "none", borderRadius: 4, cursor: "pointer",
  fontSize: 14, fontWeight: 500, transition: "background 0.1s",
  display: "flex", alignItems: "center", justifyContent: "center",
  userSelect: "none",
};

function Btn({
  label, onClick, wide, accent, muted,
}: {
  label: React.ReactNode; onClick: () => void;
  wide?: boolean; accent?: boolean; muted?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const bg = accent
    ? hov ? "rgba(0,204,122,0.85)"  : "var(--green)"
    : muted
    ? hov ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"
    : hov ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.055)";
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...BTN_BASE,
        gridColumn: wide ? "span 2" : undefined,
        background: bg,
        color: accent ? "#04080f" : muted ? "var(--ink-2)" : "var(--ink-0)",
        fontWeight: accent ? 700 : muted ? 400 : 500,
      }}
    >
      {label}
    </button>
  );
}

export default function Calculator() {
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authed = !!(session as any)?.twoFactorVerified;

  const [open,    setOpen]    = useState(false);
  const [display, setDisplay] = useState("0");
  const [expr,    setExpr]    = useState("");
  const [prev,    setPrev]    = useState<number | null>(null);
  const [op,      setOp]      = useState<CalcOp>(null);
  const [fresh,   setFresh]   = useState(false);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef({ active: false, mx: 0, my: 0, px: 0, py: 0 });

  useEffect(() => {
    setPos({ x: Math.max(20, window.innerWidth - 340), y: 88 });
  }, []);

  /* ── Ctrl+` toggle ─────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "`") { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Open via custom event (e.g. from nav dropdown) ── */
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-calculator", handler);
    return () => window.removeEventListener("open-calculator", handler);
  }, []);

  /* ── Drag ──────────────────────────────────────────── */
  const onHeaderDown = (e: React.MouseEvent) => {
    drag.current = { active: true, mx: e.clientX, my: e.clientY, px: pos?.x ?? 0, py: pos?.y ?? 0 };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current.active) return;
      setPos({
        x: drag.current.px + (e.clientX - drag.current.mx),
        y: drag.current.py + (e.clientY - drag.current.my),
      });
    };
    const onUp = () => { drag.current.active = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  /* ── Calculator logic ──────────────────────────────── */
  const pressDigit = useCallback((d: string) => {
    setDisplay(cur => {
      if (fresh) { setFresh(false); return d === "." ? "0." : d; }
      if (cur === "0" && d !== ".") return d;
      if (d === "." && cur.includes(".")) return cur;
      if (cur.replace("-", "").length >= 15) return cur;
      return cur + d;
    });
  }, [fresh]);

  const pressOp = useCallback((nextOp: CalcOp) => {
    const cur = parseFloat(display);
    if (prev !== null && op && !fresh) {
      const res = compute(prev, op, cur);
      const rs  = fmtNum(res);
      setDisplay(rs);
      setExpr(`${rs} ${nextOp}`);
      setPrev(res);
    } else {
      setExpr(`${display} ${nextOp}`);
      setPrev(cur);
    }
    setOp(nextOp);
    setFresh(true);
  }, [display, prev, op, fresh]);

  const pressEquals = useCallback(() => {
    if (prev === null || op === null) return;
    const cur = parseFloat(display);
    const res = compute(prev, op, cur);
    setExpr(`${fmtNum(prev)} ${op} ${display} =`);
    setDisplay(fmtNum(res));
    setPrev(null);
    setOp(null);
    setFresh(true);
  }, [display, prev, op]);

  const pressClear = () => {
    setDisplay("0"); setExpr(""); setPrev(null); setOp(null); setFresh(false);
  };
  const pressCE = () => { setDisplay("0"); setFresh(false); };
  const pressBack = () => {
    if (fresh) return;
    setDisplay(d => d.length <= 1 ? "0" : d.slice(0, -1));
  };
  const pressPct = () => {
    const cur = parseFloat(display);
    const res = prev !== null && (op === "+" || op === "−") ? prev * cur / 100 : cur / 100;
    setDisplay(fmtNum(res));
    setFresh(true);
  };
  const pressRecip = () => {
    const cur = parseFloat(display);
    setExpr(`1/(${display})`);
    setDisplay(fmtNum(1 / cur));
    setFresh(true);
  };
  const pressSq = () => {
    const cur = parseFloat(display);
    setExpr(`sqr(${display})`);
    setDisplay(fmtNum(cur * cur));
    setFresh(true);
  };
  const pressSqrt = () => {
    const cur = parseFloat(display);
    setExpr(`√(${display})`);
    setDisplay(fmtNum(Math.sqrt(cur)));
    setFresh(true);
  };
  const pressNegate = () => {
    setDisplay(d => d === "0" ? "0" : d.startsWith("-") ? d.slice(1) : "-" + d);
  };

  /* ── Keyboard input (only when open, no input focused) */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if ("0123456789".includes(e.key)) { pressDigit(e.key); return; }
      if (e.key === ".")         { pressDigit("."); return; }
      if (e.key === "+")         { pressOp("+"); return; }
      if (e.key === "-")         { pressOp("−"); return; }
      if (e.key === "*")         { pressOp("×"); return; }
      if (e.key === "/")         { e.preventDefault(); pressOp("÷"); return; }
      if (e.key === "Enter" || e.key === "=") { pressEquals(); return; }
      if (e.key === "Backspace") { pressBack(); return; }
      if (e.key === "Delete")    { pressCE(); return; }
      if (e.key === "Escape")    { pressClear(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pressDigit, pressOp, pressEquals]);

  if (!authed || !pos) return null;

  const displayFontSize = display.length > 12 ? 18 : display.length > 8 ? 22 : 28;

  return (
    <>
      {/* Keyboard hint chip — always shown when authed */}
      {!open && (
        <div
          title="Open calculator (Ctrl+`)"
          onClick={() => setOpen(true)}
          style={{
            position: "fixed", bottom: 60, right: 16, zIndex: 190,
            background: "rgba(4,8,15,0.80)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5,
            padding: "3px 8px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
            opacity: 0.6, transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = "1"}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = "0.6"}
        >
          <span style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>Ctrl+`</span>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden style={{ flexShrink: 0, color: "var(--ink-3)" }}>
            <rect x="1.5" y="1.5" width="9" height="9" rx="1.8" stroke="currentColor" strokeWidth="1.0"/>
            <rect x="3" y="3.5" width="1.6" height="1.2" rx="0.4" fill="currentColor"/>
            <rect x="7.4" y="3.5" width="1.6" height="1.2" rx="0.4" fill="currentColor"/>
            <rect x="3" y="5.4" width="1.6" height="1.2" rx="0.4" fill="currentColor"/>
            <rect x="7.4" y="5.4" width="1.6" height="1.2" rx="0.4" fill="currentColor"/>
            <rect x="3" y="7.3" width="1.6" height="1.2" rx="0.4" fill="currentColor"/>
            <rect x="7.4" y="7.3" width="1.6" height="1.2" rx="0.4" fill="currentColor"/>
          </svg>
        </div>
      )}

      {open && (
        <div
          style={{
            position: "fixed", zIndex: 500,
            left: pos.x, top: pos.y,
            width: 300,
            background: "rgba(14,20,30,0.97)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 10,
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          {/* Header — drag handle */}
          <div
            onMouseDown={onHeaderDown}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", cursor: "grab",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.05em" }}>
              CALCULATOR
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--ink-3)", fontSize: 14, lineHeight: 1, padding: "0 2px",
                display: "flex", alignItems: "center",
              }}
            >
              ×
            </button>
          </div>

          {/* Display */}
          <div style={{ padding: "12px 16px 8px", textAlign: "right" }}>
            <div style={{
              minHeight: 18, fontSize: 11, color: "var(--ink-4)",
              fontFamily: "var(--font-mono)", marginBottom: 4,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {expr || " "}
            </div>
            <div style={{
              fontSize: displayFontSize, fontWeight: 300, color: "var(--ink-0)",
              fontFamily: "var(--font-mono)", letterSpacing: "-0.02em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {display}
            </div>
          </div>

          {/* Buttons */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gridAutoRows: 52,
            gap: 4, padding: "4px 10px 10px",
          }}>
            {/* Row 1 */}
            <Btn label="%" onClick={pressPct} muted />
            <Btn label="CE" onClick={pressCE} muted />
            <Btn label="C"  onClick={pressClear} muted />
            <Btn label="⌫"  onClick={pressBack} muted />
            {/* Row 2 */}
            <Btn label="¹∕ₓ" onClick={pressRecip} muted />
            <Btn label="x²"  onClick={pressSq}    muted />
            <Btn label="²√x" onClick={pressSqrt}  muted />
            <Btn label="÷"   onClick={() => pressOp("÷")} muted />
            {/* Row 3 */}
            <Btn label="7" onClick={() => pressDigit("7")} />
            <Btn label="8" onClick={() => pressDigit("8")} />
            <Btn label="9" onClick={() => pressDigit("9")} />
            <Btn label="×" onClick={() => pressOp("×")} muted />
            {/* Row 4 */}
            <Btn label="4" onClick={() => pressDigit("4")} />
            <Btn label="5" onClick={() => pressDigit("5")} />
            <Btn label="6" onClick={() => pressDigit("6")} />
            <Btn label="−" onClick={() => pressOp("−")} muted />
            {/* Row 5 */}
            <Btn label="1" onClick={() => pressDigit("1")} />
            <Btn label="2" onClick={() => pressDigit("2")} />
            <Btn label="3" onClick={() => pressDigit("3")} />
            <Btn label="+" onClick={() => pressOp("+")} muted />
            {/* Row 6 */}
            <Btn label="+/−" onClick={pressNegate} />
            <Btn label="0"   onClick={() => pressDigit("0")} />
            <Btn label="."   onClick={() => pressDigit(".")} />
            <Btn label="="   onClick={pressEquals} accent />
          </div>

        </div>
      )}
    </>
  );
}
