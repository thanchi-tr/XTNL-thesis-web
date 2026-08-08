"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ShowToast = (kind: "success" | "error", text: string) => void;

interface DebugPreview {
  outliersCount: number;
  outliers:      Record<string, unknown>[];
  generatedAt:   string | null;
}

// A real pipeline run's expected duration was ~35-43s, but CloudWatch shows
// actual Duration averaging ~102s and peaking at ~133s (Errors: 0 — it's
// genuinely running, just slower than expected; see infra/sam/template.yaml's
// LoggingConfig fix, which was silently swallowing the logs needed to
// diagnose why). The POST to /api/session/trigger-pipeline can also itself
// block for up to API Gateway's ~29s timeout before even returning (a 504
// there means "still running", not failure — see the route). Poll for a
// window generous enough to cover POST-latency + the slower real-world
// duration, with margin — tighten this back down once the root cause of the
// slowdown is fixed and durations return to the expected range.
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS      = 180_000;
const LIVE_OVERLAY_MS  = 60_000; // 1-minute confirmation popup for a live run — see LiveRunOverlay

/**
 * Full-screen "live run committed" confirmation — styled after the
 * Focus-Window challenge popup (same card shell, same SVG countdown ring).
 * The pipeline itself reliably completes; this isn't polling anything, it's
 * just a fixed 1-minute pause before automatically triggering the Analysis
 * Session step (dispatched as a window event PipelineBanner.tsx listens
 * for), matching the same manual flow a human clicking that button runs.
 */
function LiveRunOverlay({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [remaining, setRemaining] = useState(60);
  const startRef = useRef(Date.now());
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    startRef.current = Date.now();
    const tick = () => {
      const elapsed   = Date.now() - startRef.current;
      const remainMs  = Math.max(0, LIVE_OVERLAY_MS - elapsed);
      setRemaining(Math.ceil(remainMs / 1000));
      if (remainMs > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r       = 50;
  const circ    = 2 * Math.PI * r;
  const dashOff = circ * (1 - remaining / 60);
  const ringClr = remaining > 20 ? "var(--green)" : remaining > 10 ? "#f5a623" : "var(--red, #e53e3e)";

  return createPortal(
    <div
      role="alertdialog"
      aria-label="Live pipeline run committed"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "var(--canvas)",
        backgroundImage: [
          "radial-gradient(ellipse 80% 55% at 50% 38%, rgba(0,204,122,0.07) 0%, transparent 68%)",
          "radial-gradient(ellipse 44% 32% at 90% 90%, rgba(0,130,255,0.016) 0%, transparent 50%)",
        ].join(","),
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
        padding: 16,
      }}
    >
      <div
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
          position: "relative" as const,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          title="Cancel — will not auto-trigger Analysis Session"
          style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 16, lineHeight: 1, padding: 4 }}
        >
          ✕
        </button>

        <p style={{
          margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase" as const, color: "var(--green)",
          fontFamily: "var(--font-mono), monospace", textShadow: "0 0 22px rgba(0,204,122,0.38)",
        }}>
          Live Run Triggered
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "var(--ink-0)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
          Committing To Production
        </p>
        <p style={{ margin: "0 0 28px", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          DB write, LLM audit, and report uploads are running in the background.
        </p>

        <div style={{ width: "100%", height: 1, background: "var(--line)", marginBottom: 24 }} />

        <div style={{ position: "relative", width: 120, height: 120, marginBottom: 14 }}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} aria-hidden>
            <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(0,204,122,0.1)" strokeWidth="3.5" />
            <circle
              cx="60" cy="60" r={r} fill="none"
              stroke={ringClr} strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={`${circ}`}
              strokeDashoffset={dashOff}
              style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s" }}
            />
          </svg>
          <div style={{
            position: "absolute", inset: 10, borderRadius: "50%",
            background: "rgba(0,204,122,0.09)", boxShadow: "0 0 28px rgba(0,204,122,0.15)",
          }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: "var(--green)", lineHeight: 1, textShadow: "0 0 20px rgba(0,204,122,0.45)" }}>
              {remaining}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1, color: "var(--ink-3)", fontFamily: "var(--font-mono), monospace" }}>
              seconds
            </span>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-2)" }}>
          Analysis Session will unlock automatically when this finishes.
        </p>
      </div>
    </div>,
    document.body
  );
}

/**
 * Staging gate for the weekly pipeline — run a debug preview (skips DB write,
 * real LLM audit, and report uploads; quarantine export still lands on
 * OneDrive under Quarantine/debug/) as many times as needed, review the
 * flagged outliers, then explicitly commit the same run live.
 *
 * Client-side state only — nothing here needs to survive a reload or be
 * seen by a different analyst, unlike weekly sign-off. "Run Debug Preview"
 * stays disabled until every live trade for the week has been processed;
 * "Approve & Run Live" doesn't render at all until a debug preview has
 * completed in this browser tab — surfacing a disabled button before that
 * point implied it was an alternative first step, when it isn't.
 */
export default function PipelineStagingGate({ showToast, allTradesProcessed }: { showToast?: ShowToast; allTradesProcessed: boolean }) {
  const [preview,          setPreview]          = useState<DebugPreview | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [running,          setRunning]          = useState<"debug" | "live" | null>(null);
  const [cooldownPct,      setCooldownPct]      = useState(0);
  const [error,            setError]            = useState<string | null>(null);
  const [liveRunAt,        setLiveRunAt]        = useState<string | null>(null);
  const [showLiveOverlay,  setShowLiveOverlay]  = useState(false);
  const pollTORef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPreview = useCallback(async (): Promise<DebugPreview | null> => {
    setLoading(true);
    let result: DebugPreview | null = null;
    try {
      const r = await fetch("/api/session/trigger-pipeline");
      if (r.ok) {
        result = await r.json();
        setPreview(result);
      }
    } catch { /* silent — keep last known preview */ }
    setLoading(false);
    return result;
  }, []);

  useEffect(() => { void fetchPreview(); }, [fetchPreview]);
  useEffect(() => () => {
    if (pollTORef.current) clearTimeout(pollTORef.current);
  }, []);

  /* Poll until a debug preview newer than `baselineGeneratedAt` shows up, or
     give up after MAX_POLL_MS with a clear "still running" message instead
     of silently reverting to the idle button. */
  const pollForNewPreview = useCallback((baselineGeneratedAt: string | null) => {
    const start = Date.now();
    const poll = async () => {
      const elapsed = Date.now() - start;
      setCooldownPct(Math.max(0, 100 - (elapsed / MAX_POLL_MS) * 100));

      const result = await fetchPreview();
      if (result?.generatedAt && result.generatedAt !== baselineGeneratedAt) {
        setRunning(null);
        return;
      }

      if (elapsed >= MAX_POLL_MS) {
        setRunning(null);
        setError("Preview is taking longer than expected — the pipeline may still be running. Check back shortly or click Run Debug Preview again.");
        return;
      }
      pollTORef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();
  }, [fetchPreview]);

  const runDebug = useCallback(() => {
    if (running) return;
    setRunning("debug");
    setCooldownPct(100);
    setError(null);
    const baselineGeneratedAt = preview?.generatedAt ?? null;

    (async () => {
      try {
        const r = await fetch("/api/session/trigger-pipeline", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ mode: "debug" }),
        });
        // A 504 here is API Gateway's ~29s timeout, not a failure — the
        // Lambda invocation continues running regardless (see route.ts).
        if (!r.ok && r.status !== 504) {
          const j = await r.json().catch(() => ({}));
          setError(j.error ?? `Trigger failed (${r.status})`);
          setRunning(null);
          return;
        }
      } catch {
        setError("Network error — could not reach the server.");
        setRunning(null);
        return;
      }
      pollForNewPreview(baselineGeneratedAt);
    })();
  }, [running, preview, pollForNewPreview]);

  /* Live run — fire-and-forget. The trigger POST can itself block for up to
     API Gateway's ~29s timeout before even returning, and the pipeline
     reliably completes regardless (confirmed via CloudWatch — Errors: 0);
     the UI must not sit there waiting on that response. Show the
     confirmation popup immediately instead of a "Running live…" button
     state that has nothing real to report progress on. */
  const runLive = useCallback(() => {
    if (running) return;
    setRunning("live");
    setError(null);
    fetch("/api/session/trigger-pipeline", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ mode: "live" }),
    }).catch(() => { /* background — surfaced via CloudWatch, not the UI */ });
    setLiveRunAt(new Date().toISOString());
    setShowLiveOverlay(true);
  }, [running]);

  const finishLiveOverlay = useCallback(() => {
    setShowLiveOverlay(false);
    setRunning(null);
    window.dispatchEvent(new CustomEvent("trigger-analysis-session"));
    showToast?.("success", "Live run committed — triggering Analysis Session");
  }, [showToast]);

  const cancelLiveOverlay = useCallback(() => {
    setShowLiveOverlay(false);
    setRunning(null);
  }, []);

  const hasDebugRun   = !!preview?.generatedAt;
  const outlierCount  = preview?.outliersCount ?? 0;
  const statusColor   = !hasDebugRun ? "var(--ink-3)" : outlierCount > 0 ? "var(--amber)" : "var(--green)";
  const statusLabel   = !hasDebugRun ? "No preview yet" : outlierCount > 0 ? `${outlierCount} flagged` : "Clean";

  return (
    <div className="card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="label-xs" style={{ color: "var(--ink-3)" }}>PIPELINE STAGING GATE</span>
        <span
          className="mono"
          style={{
            fontSize: 10, fontWeight: 700, color: statusColor,
            padding: "2px 7px", borderRadius: 4,
            border: `1px solid ${statusColor}`, opacity: 0.9,
          }}
        >
          {loading ? "…" : statusLabel}
        </span>
      </div>

      {hasDebugRun && (
        <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5 }}>
          Last preview: {new Date(preview!.generatedAt!).toLocaleString()}
          {outlierCount > 0 && (
            <>
              {" — "}
              <span style={{ color: "var(--amber)" }}>review flagged rows before approving live</span>
            </>
          )}
        </div>
      )}

      {!allTradesProcessed && !loading && (
        <div style={{ fontSize: 11, color: "var(--amber)", lineHeight: 1.5 }}>
          Waiting on unprocessed live trades — preview unlocks once every trade this week is scored.
        </div>
      )}

      {liveRunAt && (
        <div style={{ fontSize: 11, color: "var(--green)" }}>
          ✓ Live run triggered {new Date(liveRunAt).toLocaleTimeString()}
        </div>
      )}

      {error && (
        <span className="mono" style={{ fontSize: 10.5, color: "var(--red)" }}>⚠ {error}</span>
      )}

      <button
        className="btn btn-secondary"
        onClick={runDebug}
        disabled={running !== null || !allTradesProcessed}
        title={
          !allTradesProcessed
            ? "All live trades for this week must be processed before a preview can run."
            : "Runs the pipeline without writing to the DB, calling the real LLM auditor, or uploading reports — only the quarantine preview is exported. Safe to re-run as many times as needed."
        }
        style={{ opacity: running !== null || !allTradesProcessed ? 0.6 : 1, cursor: running !== null || !allTradesProcessed ? "not-allowed" : "pointer" }}
      >
        {running === "debug" ? "Running preview…" : "Run Debug Preview"}
      </button>
      {running === "debug" && (
        <div style={{ width: "100%", height: 2, borderRadius: 1, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${cooldownPct}%`, background: "var(--amber)", transition: "width 0.1s linear" }} />
        </div>
      )}

      {hasDebugRun && (
        <button
          className="btn btn-primary"
          onClick={runLive}
          disabled={running !== null}
          title="Commits this run live — real DB write, real LLM audit, real report uploads."
          style={{ opacity: running !== null ? 0.45 : 1, cursor: running !== null ? "not-allowed" : "pointer" }}
        >
          Approve & Run Live
        </button>
      )}

      {showLiveOverlay && <LiveRunOverlay onDone={finishLiveOverlay} onCancel={cancelLiveOverlay} />}
    </div>
  );
}
