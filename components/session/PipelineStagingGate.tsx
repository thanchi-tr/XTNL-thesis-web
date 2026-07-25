"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
const LIVE_COOLDOWN_MS = 140_000; // fire-and-forget for live — no result to poll, just a realistic "it's probably done" cooldown

/**
 * Staging gate for the weekly pipeline — run a debug preview (skips DB write,
 * real LLM audit, and report uploads; quarantine export still lands on
 * OneDrive under Quarantine/debug/) as many times as needed, review the
 * flagged outliers, then explicitly commit the same run live.
 *
 * Client-side state only — nothing here needs to survive a reload or be
 * seen by a different analyst, unlike weekly sign-off. "Approve & Run Live"
 * stays disabled until a debug preview has completed in this browser tab.
 */
export default function PipelineStagingGate({ showToast }: { showToast?: ShowToast }) {
  const [preview,     setPreview]     = useState<DebugPreview | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [running,     setRunning]     = useState<"debug" | "live" | null>(null);
  const [cooldownPct, setCooldownPct] = useState(0);
  const [error,       setError]       = useState<string | null>(null);
  const [liveRunAt,   setLiveRunAt]   = useState<string | null>(null);
  const rafRef     = useRef<number>(0);
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
    cancelAnimationFrame(rafRef.current);
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

  const runMode = useCallback((mode: "debug" | "live") => {
    if (running) return;
    setRunning(mode);
    setCooldownPct(100);
    setError(null);
    const baselineGeneratedAt = preview?.generatedAt ?? null;

    (async () => {
      let hardFailed = false;
      try {
        const r = await fetch("/api/session/trigger-pipeline", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ mode }),
        });
        // A 504 here is API Gateway's ~29s timeout, not a failure — the
        // Lambda invocation continues running regardless (see route.ts).
        if (!r.ok && r.status !== 504) {
          const j = await r.json().catch(() => ({}));
          setError(j.error ?? `Trigger failed (${r.status})`);
          hardFailed = true;
        }
      } catch {
        setError("Network error — could not reach the server.");
        hardFailed = true;
      }

      if (hardFailed) {
        setRunning(null);
        return;
      }

      if (mode === "debug") {
        pollForNewPreview(baselineGeneratedAt);
      } else {
        const start = Date.now();
        const tick = () => {
          const elapsed   = Date.now() - start;
          const remaining = Math.max(0, 1 - elapsed / LIVE_COOLDOWN_MS);
          setCooldownPct(remaining * 100);
          if (remaining > 0) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            setRunning(null);
            setLiveRunAt(new Date().toISOString());
            showToast?.("success", "Live pipeline run triggered");
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    })();
  }, [running, preview, pollForNewPreview, showToast]);

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
        onClick={() => runMode("debug")}
        disabled={running !== null}
        title="Runs the pipeline without writing to the DB, calling the real LLM auditor, or uploading reports — only the quarantine preview is exported. Safe to re-run as many times as needed."
        style={{ opacity: running !== null ? 0.6 : 1, cursor: running !== null ? "not-allowed" : "pointer" }}
      >
        {running === "debug" ? "Running preview…" : "Run Debug Preview"}
      </button>
      {running === "debug" && (
        <div style={{ width: "100%", height: 2, borderRadius: 1, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${cooldownPct}%`, background: "var(--amber)", transition: "width 0.1s linear" }} />
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={() => runMode("live")}
        disabled={running !== null || !hasDebugRun}
        title={hasDebugRun ? "Commits this run live — real DB write, real LLM audit, real report uploads." : "Run a debug preview first"}
        style={{ opacity: running !== null || !hasDebugRun ? 0.45 : 1, cursor: running !== null || !hasDebugRun ? "not-allowed" : "pointer" }}
      >
        {running === "live" ? "Running live…" : "Approve & Run Live"}
      </button>
      {running === "live" && (
        <div style={{ width: "100%", height: 2, borderRadius: 1, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${cooldownPct}%`, background: "var(--green)", transition: "width 0.1s linear" }} />
        </div>
      )}
    </div>
  );
}
