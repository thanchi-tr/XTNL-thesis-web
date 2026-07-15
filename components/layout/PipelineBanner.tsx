"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession }                               from "next-auth/react";
import { getSessionStatus }                         from "@/lib/sessionStatus";

/* ─── Performance state helpers ───────────────────────────────────── */
type CelebrationMetrics = { capture: number; rating: number };

function parseAuditMetrics(raw: string): CelebrationMetrics {
  const val = (key: string) =>
    raw.match(new RegExp(`\\*\\s*${key.replace(/[/()]/g, "\\$&")}\\s*:\\s*(.+)`))?.[1]?.trim() ?? "";
  return {
    rating:  parseFloat(val("Rating"))       || 0,
    capture: parseFloat(val("Capture Rate")) || 0,
  };
}

type PerfState = { label: string; color: string; bg: string; urgent: boolean };

function captureState(pct: number): PerfState {
  if (pct < 40)  return { label: "DEPLOY COUNTER MEASURE", color: "#ff4d4d", bg: "rgba(255,77,77,0.08)",   urgent: true  };
  if (pct >= 95) return { label: "SUPER PERFORMANCE",      color: "#FFD700", bg: "rgba(255,215,0,0.07)",   urgent: false };
  if (pct >= 82) return { label: "CONGRATULATIONS",        color: "var(--green)", bg: "rgba(0,204,122,0.07)", urgent: false };
  return               { label: "WITHIN RANGE",            color: "var(--ink-3)", bg: "rgba(255,255,255,0.03)", urgent: false };
}

function efficiencyState(rating: number): PerfState {
  if (rating < 0.65)  return { label: "DEPLOY COUNTER MEASURE", color: "#ff4d4d", bg: "rgba(255,77,77,0.08)",   urgent: true  };
  if (rating >= 0.95) return { label: "SUPERB PERFORMANCE",     color: "#FFD700", bg: "rgba(255,215,0,0.07)",   urgent: false };
  if (rating >= 0.82) return { label: "BASELINE MET",           color: "var(--green)", bg: "rgba(0,204,122,0.07)", urgent: false };
  return                     { label: "WITHIN RANGE",           color: "var(--ink-3)", bg: "rgba(255,255,255,0.03)", urgent: false };
}

/* ─── Celebration overlay ─────────────────────────────────────────── */
function CelebrationOverlay({ reportTs, metrics, onDone }: {
  reportTs: string;
  metrics:  CelebrationMetrics | null;
  onDone:   () => void;
}) {
  const [pct, setPct]           = useState(100);
  const [exiting, setExiting]   = useState(false);
  const rafRef                  = useRef<number>(0);
  const DURATION                = 6000;

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDone, 400);
  }, [onDone]);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1 - elapsed / DURATION);
      setPct(remaining * 100);
      if (remaining > 0) rafRef.current = requestAnimationFrame(tick);
      else dismiss();
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dismiss]);

  return (
    <>
      <style>{`
        @keyframes _xscan { 0%{transform:translateY(-10%)} 100%{transform:translateY(110vh)} }
        @keyframes _xring { 0%,100%{opacity:.22;transform:scale(1)} 50%{opacity:.55;transform:scale(1.07)} }
        @keyframes _xfade { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes _xcheck { to{stroke-dashoffset:0} }
        @keyframes _xpulse { 0%,100%{box-shadow:0 0 0 0 rgba(0,204,122,0)} 50%{box-shadow:0 0 60px 12px rgba(0,204,122,0.12)} }
        @keyframes _xticker { from{width:100%} to{width:0%} }
      `}</style>
      <div
        onClick={dismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 1100,
          background: exiting ? "rgba(4,8,15,0)" : "rgba(4,8,15,0.97)",
          backdropFilter: exiting ? "none" : "blur(28px) saturate(200%)",
          WebkitBackdropFilter: exiting ? "none" : "blur(28px) saturate(200%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.4s, backdrop-filter 0.4s",
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        {/* Scan line */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{
            position: "absolute", left: 0, right: 0, height: 120,
            background: "linear-gradient(to bottom, transparent, rgba(0,204,122,0.04), transparent)",
            animation: "_xscan 4s linear infinite",
          }} />
        </div>

        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.025,
          backgroundImage: "linear-gradient(rgba(0,204,122,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,204,122,1) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }} />

        {/* Corner brackets */}
        {([
          { top: 32, left: 32, deg: 0 },
          { top: 32, right: 32, deg: 90 },
          { bottom: 32, right: 32, deg: 180 },
          { bottom: 32, left: 32, deg: 270 },
        ] as const).map(({ deg, ...pos }, i) => (
          <svg key={i} width="24" height="24" viewBox="0 0 24 24" fill="none"
            style={{ position: "absolute", ...pos, transform: `rotate(${deg}deg)`, opacity: 0.25, pointerEvents: "none" }}>
            <path d="M2 10V2h8" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ))}

        {/* Central card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 32,
            padding: "56px 72px 44px",
            background: "rgba(8,14,24,0.70)",
            border: "1px solid rgba(0,204,122,0.18)",
            borderRadius: 16,
            animation: "_xpulse 3s ease-in-out infinite",
            opacity: exiting ? 0 : 1,
            transition: "opacity 0.35s",
            cursor: "default",
            minWidth: 360,
          }}
        >
          {/* Checkmark */}
          <div style={{ position: "relative", animation: "_xfade 0.5s ease forwards" }}>
            <div style={{ position: "absolute", inset: -14, borderRadius: "50%", border: "1px solid rgba(0,204,122,0.28)", animation: "_xring 2.4s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: -26, borderRadius: "50%", border: "1px solid rgba(0,204,122,0.12)", animation: "_xring 2.4s ease-in-out infinite 0.4s" }} />
            <div style={{
              width: 88, height: 88, borderRadius: "50%",
              border: "1.5px solid rgba(0,204,122,0.35)",
              background: "rgba(0,204,122,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M9 20l8 8 14-14"
                  stroke="var(--green)" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="46" strokeDashoffset="46"
                  style={{ animation: "_xcheck 0.55s 0.15s ease forwards" }}
                />
              </svg>
            </div>
          </div>

          {/* Label */}
          <div style={{ textAlign: "center", animation: "_xfade 0.5s 0.2s ease both" }}>
            <div style={{ fontSize: 8.5, letterSpacing: "0.24em", color: "var(--green)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 18, opacity: 0.75 }}>
              XTNL SOVEREIGN TRUST
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--ink-0)", letterSpacing: "-0.01em", fontFamily: "var(--font-mono)", lineHeight: 1.15 }}>
              ANALYSIS SESSION
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--green)", letterSpacing: "-0.01em", fontFamily: "var(--font-mono)", lineHeight: 1.15 }}>
              COMPLETE
            </div>
          </div>

          {/* Report timestamp */}
          <div style={{ textAlign: "center", animation: "_xfade 0.5s 0.35s ease both" }}>
            <div style={{ fontSize: 9.5, color: "var(--ink-4)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>
              AUDIT REPORT VALIDATED
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-2)", fontFamily: "var(--font-mono)", letterSpacing: "0.03em" }}>
              {reportTs}
            </div>
          </div>

          {/* Performance state panel */}
          {metrics && (() => {
            const cs = captureState(metrics.capture);
            const es = efficiencyState(metrics.rating);
            return (
              <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, animation: "_xfade 0.5s 0.45s ease both" }}>
                {[
                  { key: "CAPTURE RATE", value: `${metrics.capture.toFixed(1)}%`, state: cs },
                  { key: "EFFICIENCY",   value: `${(metrics.rating * 100).toFixed(1)}%`, state: es },
                ].map(({ key, value, state }) => (
                  <div key={key} style={{
                    background: state.bg,
                    border: `1px solid ${state.urgent ? "rgba(255,77,77,0.3)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 8, padding: "14px 16px",
                    display: "flex", flexDirection: "column", gap: 6,
                    boxShadow: state.urgent ? "0 0 20px rgba(255,77,77,0.12)" : "none",
                  }}>
                    <div style={{ fontSize: 8, letterSpacing: "0.18em", color: "var(--ink-4)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                      {key}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: state.color, fontFamily: "var(--font-mono)", letterSpacing: "-0.01em" }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: state.color, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", opacity: 0.9 }}>
                      {state.label}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Countdown bar */}
          <div style={{ width: "100%", animation: "_xfade 0.5s 0.5s ease both" }}>
            <div style={{ width: "100%", height: 1.5, background: "rgba(255,255,255,0.05)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{
                height: "100%", background: "var(--green)", borderRadius: 1,
                width: `${pct}%`, transition: "width 0.1s linear",
              }} />
            </div>
            <div style={{ marginTop: 12, fontSize: 8.5, color: "var(--ink-4)", fontFamily: "var(--font-mono)", letterSpacing: "0.14em", textAlign: "center" }}>
              CLICK TO DISMISS
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function isAnalystDay(): boolean {
  // Must mirror SessionClient getSessionState() exactly:
  // analyst = Sunday (day 0) all day, or Saturday (day 6) from 1 AM onwards (Melbourne time)
  const md  = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
  const day = md.getDay();
  const h   = md.getHours();
  return day === 0 || (day === 6 && h >= 1);
}

type PipelineData = {
  ingestionDone:   boolean;
  processDone:     boolean;
  total:           number;
  totalFields:     number;
  processedFields: number;
};

function Check() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden style={{ color: "var(--ink-3)", flexShrink: 0 }}>
      <path d="M1 6h10M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Step({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  const color  = done ? "var(--green)" : active ? "var(--amber)" : "var(--ink-3)";
  const border = done ? "rgba(0,204,122,0.25)" : active ? "rgba(240,160,48,0.25)" : "var(--line)";
  const bg     = done ? "rgba(0,204,122,0.07)" : active ? "rgba(240,160,48,0.05)" : "transparent";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 4,
      border: `1px solid ${border}`, background: bg,
      fontSize: 11, fontWeight: 600, color, whiteSpace: "nowrap",
    }}>
      {done && <Check />}
      {label}
    </div>
  );
}

export default function PipelineBanner() {
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authed = !!(session as any)?.twoFactorVerified;

  const [analystDay,       setAnalystDay]       = useState(false);
  const [sessionActive,    setSessionActive]    = useState(false);
  const [pipe,             setPipe]             = useState<PipelineData | null>(null);
  const [analysisDone,       setAnalysisDone]       = useState(false);
  const [analysisChecking,   setAnalysisChecking]   = useState(false);
  const [staleModal,         setStaleModal]         = useState(false);
  const [celebration,        setCelebration]        = useState(false);
  const [celebrationTs,      setCelebrationTs]      = useState("");
  const [celebrationMetrics, setCelebrationMetrics] = useState<CelebrationMetrics | null>(null);
  const [collapsed,        setCollapsed]        = useState(false);
  const [isMobile,         setIsMobile]         = useState(false);

  /* Responsive breakpoint */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  /* On mount: check server for this week's analysis completion (persists across devices/refreshes) */
  useEffect(() => {
    if (!authed) return;
    fetch("/api/session/analysis-session")
      .then(r => r.ok ? r.json() as Promise<{ done: boolean }> : null)
      .then(j => { if (j?.done) setAnalysisDone(true); })
      .catch(() => {});
  }, [authed]);

  /* Time-window flags every 30 s */
  useEffect(() => {
    const tick = () => {
      setAnalystDay(isAnalystDay());
      setSessionActive(getSessionStatus().inSession);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  /* Re-expand when analyst day starts — but not if all tasks are already done */
  useEffect(() => { if (analystDay && !analysisDone) setCollapsed(false); }, [analystDay, analysisDone]);

  const fetchPipeline = useCallback(async () => {
    if (!authed) return;
    try {
      const r = await fetch("/api/session/pipeline-status");
      if (r.ok) setPipe(await r.json());
    } catch { /* silent */ }
  }, [authed]);

  useEffect(() => {
    if (!authed || !analystDay) return;
    fetchPipeline();
    const id = setInterval(fetchPipeline, 30_000);
    return () => clearInterval(id);
  }, [authed, analystDay, fetchPipeline]);

  useEffect(() => {
    const handler = () => fetchPipeline();
    window.addEventListener("pipeline-refresh", handler);
    return () => window.removeEventListener("pipeline-refresh", handler);
  }, [fetchPipeline]);

  function isCurrentWeekReport(raw: string): boolean {
    const m = raw.match(/TIMESTAMP:\s*(\d{4}-\d{2}-\d{2})/);
    if (!m) return false;
    const melbNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" }));
    const daysBack = melbNow.getDay() === 0 ? 6 : melbNow.getDay() - 1;
    const monday = new Date(melbNow);
    monday.setDate(melbNow.getDate() - daysBack);
    const mondayStr = monday.getFullYear() + "-" +
      String(monday.getMonth() + 1).padStart(2, "0") + "-" +
      String(monday.getDate()).padStart(2, "0");
    return m[1] >= mondayStr;
  }

  async function handleAnalysisSession() {
    setAnalysisChecking(true);
    try {
      const auditRes = await fetch("/api/session/audit-report");
      if (!auditRes.ok) throw new Error("fetch failed");
      const raw = await auditRes.text();
      if (isCurrentWeekReport(raw)) {
        const ts      = raw.match(/TIMESTAMP:\s*(.+)/)?.[1]?.trim() ?? "";
        const metrics = parseAuditMetrics(raw);

        window.dispatchEvent(new CustomEvent("audit-report-ready", { detail: raw }));
        setAnalysisDone(true);
        // Persist server-side so all devices + refreshes reflect done state
        fetch("/api/session/analysis-session", { method: "POST" }).catch(() => {});
        // On-demand pull: refresh the server-side report cache from OneDrive,
        // then tell the data/analytics pages to re-read it. This is the only
        // path that fetches new OneDrive data outside a cold cache miss.
        fetch("/api/data/report", { method: "POST" })
          .catch(() => {})
          .finally(() => window.dispatchEvent(new CustomEvent("analysis-session-complete")));
        setCelebrationTs(ts);
        setCelebrationMetrics(metrics);
        setCelebration(true);
      } else {
        setStaleModal(true);
      }
    } catch { /* silent — network error */ }
    finally { setAnalysisChecking(false); }
  }

  if (!authed || !analystDay) return null;

  const totalFields     = pipe?.totalFields     ?? 0;
  const processedFields = pipe?.processedFields ?? 0;
  const progress        = totalFields > 0 ? processedFields / totalFields : 0;
  const pct             = Math.round(progress * 100);
  const ingDone         = pipe?.ingestionDone ?? false;
  const procDone        = pipe?.processDone   ?? false;
  const barColor        = procDone ? "var(--green)" : "var(--amber)";
  const dotColor        = sessionActive ? "var(--green)" : "var(--ink-3)";

  /* ── Collapsed pill — matches nav user-dropdown button style ── */
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Expand pipeline status"
        aria-label="Expand pipeline status"
        style={{
          position: "fixed", bottom: 16, right: 16, zIndex: 200,
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(4,8,15,0.90)",
          backdropFilter: "blur(18px) saturate(180%)",
          WebkitBackdropFilter: "blur(18px) saturate(180%)",
          border: "1px solid rgba(0,204,122,0.20)",
          borderRadius: 5, padding: "5px 10px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
          cursor: "pointer",
        }}
      >
        <div style={{
          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
          background: barColor,
          boxShadow: `0 0 0 3px ${procDone ? "rgba(0,204,122,0.18)" : "rgba(240,160,48,0.18)"}`,
        }} />
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)", fontWeight: 600, whiteSpace: "nowrap" }}>
          Pipeline
        </span>
        <span className="mono" style={{ fontSize: 10.5, color: barColor, fontWeight: 700 }}>
          {pct}%
        </span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 5.5l3-3 3 3" stroke="var(--ink-3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    );
  }

  /* ── Full banner — mirrors nav visual treatment ──────────── */
  return (
    <>
    {celebration && (
      <CelebrationOverlay reportTs={celebrationTs} metrics={celebrationMetrics} onDone={() => { setCelebration(false); setCollapsed(true); }} />
    )}
    {staleModal && (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 900,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onClick={() => setStaleModal(false)}
      >
        <div
          style={{
            background: "var(--card)", border: "1px solid var(--line)",
            borderRadius: 10, padding: "28px 32px",
            maxWidth: 420, width: "90%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--amber)", marginBottom: 12, letterSpacing: "0.06em" }}>
            ⚠ STALE AUDIT REPORT
          </div>
          <p style={{ fontSize: 12.5, color: "var(--ink-1)", lineHeight: 1.65, margin: "0 0 12px" }}>
            The <code style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>live.audit.txt</code> report
            on OneDrive is from a <strong>previous week</strong>. Analysis Session cannot be marked complete until the current week&apos;s report is available.
          </p>
          <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.65, margin: "0 0 22px" }}>
            Execute the <strong style={{ color: "var(--ink-0)" }}>XTNL pipeline in livemode</strong> to generate this week&apos;s audit report, then return here to complete the Analysis Session.
          </p>
          <button
            onClick={() => setStaleModal(false)}
            style={{
              padding: "7px 20px", borderRadius: 5,
              border: "1px solid var(--line)", background: "transparent",
              color: "var(--ink-1)", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    )}
    <div
      role="status"
      aria-label="Session pipeline status"
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
        background: "rgba(4,8,15,0.90)",
        backdropFilter: "blur(18px) saturate(180%)",
        WebkitBackdropFilter: "blur(18px) saturate(180%)",
        borderTop: "1px solid rgba(0,204,122,0.10)",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.38)",
      }}
    >
      {/* Top-edge progress bar — desktop only */}
      {!isMobile && (
        <div style={{ width: "100%", height: 2, background: "rgba(255,255,255,0.04)" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: barColor, transition: "width 0.5s ease",
          }} />
        </div>
      )}

      {/* Inner row — uses site-container for consistent alignment with nav */}
      <div
        className="site-container"
        style={{
          display: "flex", alignItems: "center",
          gap: isMobile ? 6 : 12,
          height: isMobile ? 40 : 44,
          flexWrap: "nowrap", overflow: "hidden",
        }}
      >
        {/* Status dot + label */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: dotColor,
            boxShadow: sessionActive ? "0 0 0 3px rgba(0,204,122,0.18)" : "none",
            flexShrink: 0,
          }} />
          {!isMobile && (
            <span className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--ink-3)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {sessionActive ? "Active" : "Standby"} · Pipeline
            </span>
          )}
        </div>

        {/* Divider — desktop only */}
        {!isMobile && (
          <div style={{ width: 1, height: 14, background: "var(--line)", flexShrink: 0 }} />
        )}

        {/* Steps */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 6, flex: 1, overflow: "hidden" }}>
          <Step done={ingDone} active={!ingDone} label={isMobile ? "Ingest" : "Ingestion"} />
          <Arrow />

          {/* Process step */}
          <div style={{
            display: "flex", alignItems: "center", gap: isMobile ? 4 : 8,
            padding: "3px 8px", borderRadius: 4,
            border: `1px solid ${procDone ? "rgba(0,204,122,0.25)" : ingDone ? "rgba(240,160,48,0.25)" : "rgba(255,255,255,0.07)"}`,
            background: procDone ? "rgba(0,204,122,0.07)" : ingDone ? "rgba(240,160,48,0.05)" : "transparent",
            flexShrink: 0,
          }}>
            <span style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
              color: procDone ? "var(--green)" : ingDone ? "var(--amber)" : "var(--ink-3)",
            }}>
              {procDone && <Check />}
              {isMobile ? "Process" : "Process All Trades"}
            </span>
            {totalFields > 0 && (
              isMobile ? (
                <span className="mono" style={{ fontSize: 10, color: barColor, fontWeight: 700 }}>
                  {pct}%
                </span>
              ) : (
                <>
                  <div style={{ width: 56, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", flexShrink: 0 }}>
                    <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: barColor, transition: "width 0.5s ease" }} />
                  </div>
                  <span className="mono" style={{ fontSize: 10, color: procDone ? "var(--green)" : "var(--ink-3)", whiteSpace: "nowrap" }}>
                    {processedFields}/{totalFields}
                  </span>
                </>
              )
            )}
          </div>
          <Arrow />

          {/* Analysis step */}
          <button
            onClick={procDone && !analysisDone ? handleAnalysisSession : undefined}
            disabled={analysisChecking || !procDone || analysisDone}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "3px 8px", borderRadius: 4,
              border: `1px solid ${analysisDone ? "rgba(0,204,122,0.25)" : procDone ? "rgba(77,156,245,0.28)" : "rgba(255,255,255,0.07)"}`,
              background: analysisDone ? "rgba(0,204,122,0.07)" : procDone ? "rgba(77,156,245,0.05)" : "transparent",
              color: analysisDone ? "var(--green)" : procDone ? "var(--blue)" : "var(--ink-3)",
              fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
              cursor: procDone && !analysisDone ? "pointer" : "default",
              flexShrink: 0,
            }}
          >
            {analysisDone && <Check />}
            {analysisChecking ? "…" : isMobile ? "Analysis" : "Analysis Session"}
          </button>
        </div>

        {/* Refresh + collapse — right-aligned like nav CTAs */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: "auto", flexShrink: 0 }}>
          {!isMobile && (
            <button
              onClick={fetchPipeline}
              title="Refresh"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: "4px 6px", display: "flex", alignItems: "center", borderRadius: 4 }}
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M12 7A5 5 0 1 1 7 2a5 5 0 0 1 3.54 1.46L12 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M9 5h3V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: "4px 6px", display: "flex", alignItems: "center", borderRadius: 4 }}
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
