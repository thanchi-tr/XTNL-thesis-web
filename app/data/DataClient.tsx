"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getMondayAESTKey }                         from "@/lib/weekKey";

interface ReportData {
  content:    string;
  filename:   string;
  reportDate: string;
  fetchedAt?: string;
  _log?:      string[];
}

interface Section {
  title: string;
  body:  string;
}

function parseSections(raw: string): Section[] {
  const lines   = raw.split("\n");
  const SEP_RE  = /^={10,}$/;
  const sections: Section[] = [];
  let i = 0;
  while (i < lines.length) {
    if (SEP_RE.test(lines[i].trim())) {
      const titleLine = lines[i + 1]?.trim() ?? "";
      if (titleLine && !SEP_RE.test(titleLine) && lines[i + 2] && SEP_RE.test(lines[i + 2].trim())) {
        const bodyStart = i + 3;
        let   bodyEnd   = bodyStart;
        while (bodyEnd < lines.length && !SEP_RE.test(lines[bodyEnd].trim())) bodyEnd++;
        sections.push({ title: titleLine, body: lines.slice(bodyStart, bodyEnd).join("\n") });
        i = bodyEnd;
        continue;
      }
    }
    i++;
  }
  if (sections.length === 0) sections.push({ title: "Report", body: raw });
  return sections;
}

/* ── Section title formatter ────────────────────────────────
   Dims structural filler tokens, accents numbers + key scopes. */
const DIM_TOKENS = new Set(["FILTERED", "OPTIMAL", "SAMPLE", "DISTRIBUTION", "FOR"]);
const KEY_TOKENS = new Set(["LIVE", "REGIME", "TAIL", "ANCHOR", "THIS", "WEEK", "HOURLY"]);
const NUM_RE     = /^\d+$/;

function SectionTitle({ raw }: { raw: string }) {
  const clean = raw.replace(/ METRICS$/, "").replace(/:$/, "").trim();
  const parts  = clean.split(/(_| )/);
  return (
    <>
      {parts.map((part, i) => {
        if (part === "_")
          return <span key={i} style={{ color: "rgba(255,255,255,0.18)" }}>_</span>;
        if (part === " ")
          return <span key={i}> </span>;
        if (DIM_TOKENS.has(part))
          return <span key={i} style={{ color: "rgba(255,255,255,0.22)", fontWeight: 400 }}>{part}</span>;
        if (NUM_RE.test(part))
          return <span key={i} style={{ color: "#4d9cf5", fontWeight: 700 }}>{part}</span>;
        if (KEY_TOKENS.has(part))
          return <span key={i} style={{ color: "var(--ink-0)", fontWeight: 700 }}>{part}</span>;
        return <span key={i} style={{ color: "var(--ink-1)" }}>{part}</span>;
      })}
    </>
  );
}

/* ── Quick-stats parser for section header badges ── */
const HEALTH_RE = /\[(ELITE|SUPERB|EXCELLENT|ROBUST|STABLE|CAUTION|FAIL)\]/;
const HEALTH_COLOR: Record<string, string> = {
  ELITE: "#00cc7a", SUPERB: "#00b86e", EXCELLENT: "#34d399",
  ROBUST: "#22c4b0", STABLE: "#4d9cf5", CAUTION: "#f0a030", FAIL: "#f03a57",
};

interface QuickStats { health: string | null; sqn: string | null; n: string | null; recR: string | null }

function parseQuickStats(body: string): QuickStats {
  const healthMatch = body.match(HEALTH_RE);
  const health = healthMatch ? healthMatch[1] : null;
  const lines = body.split("\n");
  let sqn: string | null = null;
  let n: string | null = null;
  let recR: string | null = null;
  let armSample = false, armRecommend = false;
  for (const line of lines) {
    if (line.includes("SAMPLE SIZE")) { armSample = true; continue; }
    if (line.includes("RECOMMEND R") && !line.includes("|--")) { armRecommend = true; continue; }
    if (armSample && line.includes("|") && !/^[+|\-]+$/.test(line.trim())) {
      const cells = line.split("|").map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) { n = cells[0]; sqn = cells[1]; armSample = false; }
    }
    if (armRecommend && line.includes("|") && !/^[+|\-]+$/.test(line.trim())) {
      const cells = line.split("|").map(c => c.trim()).filter(Boolean);
      if (cells.length >= 1) { recR = cells[0]; armRecommend = false; }
    }
  }
  return { health, sqn, n, recR };
}

function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  const stats  = parseQuickStats(section.body);
  const col    = stats.health ? (HEALTH_COLOR[stats.health] ?? "#9ab0c8") : null;
  const recNum = stats.recR ? parseFloat(stats.recR) : null;

  return (
    <div style={{
      background: "var(--card)",
      border: col ? `1px solid ${col}20` : "1px solid var(--line-hi)",
      borderLeft: col ? `3px solid ${col}55` : "1px solid var(--line-hi)",
      borderRadius: 7, overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "11px 18px", background: "none", border: "none", cursor: "pointer",
          borderBottom: open ? "1px solid var(--line)" : "none",
        }}
      >
        {/* Title */}
        <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--font-mono)", flex: 1, textAlign: "left" }}>
          <SectionTitle raw={section.title} />
        </span>

        {/* Inline badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {stats.health && col && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: col, background: `${col}14`, border: `1px solid ${col}35`, borderRadius: 3, padding: "2px 6px" }}>
              {stats.health}
            </span>
          )}
          {stats.n && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-3)" }}>n={stats.n}</span>
          )}
          {stats.sqn && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-3)" }}>SQN {stats.sqn}</span>
          )}
          {stats.recR && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: recNum !== null && recNum > 0 ? "var(--green)" : "var(--red)" }}>
              R {stats.recR}
            </span>
          )}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transition: "transform 0.18s", transform: open ? "rotate(180deg)" : "none" }}>
            <path d="M2 3.5l3 3 3-3" stroke="var(--ink-3)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
      {open && (
        <pre style={{
          margin: 0, padding: "14px 18px",
          fontFamily: "var(--font-mono)", fontSize: 10.5,
          color: "var(--ink-2)", lineHeight: 1.75,
          overflowX: "auto", whiteSpace: "pre",
          background: "rgba(0,0,0,0.15)",
        }}>
          {section.body.trim()}
        </pre>
      )}
    </div>
  );
}


export default function DataClient() {
  const [report,  setReport]  = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[] | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  /* force=true → POST, which re-pulls from OneDrive and overwrites the server
     cache (the analyst's on-demand refresh). Default GET is read-through: it
     serves the server-side cache and only touches OneDrive on a cold miss. */
  const load = useCallback(async (withDebug = false, force = false) => {
    setLoading(true);
    setError(null);
    setDebugLog(null);
    try {
      const url  = withDebug ? "/api/data/report?debug=1" : "/api/data/report";
      const res  = await fetch(url, force ? { method: "POST" } : undefined);
      const j    = await res.json() as ReportData & { error?: string; _log?: string[] };
      if (j._log) setDebugLog(j._log);
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setReport(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* Re-fetch when Analysis Session is confirmed (same tab or other tab) */
  useEffect(() => {
    const onEvent   = () => void load();
    const onStorage = (e: StorageEvent) => { if (e.key === "xtnl_analysis_ts") void load(); };
    window.addEventListener("analysis-session-complete", onEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("analysis-session-complete", onEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, [load]);

  /* Auto-refresh Monday 4 AM AEST — poll every 60 s + on tab focus */
  const reportRef = useRef<ReportData | null>(null);
  useEffect(() => { reportRef.current = report; }, [report]);

  useEffect(() => {
    const check = () => {
      const r = reportRef.current;
      if (r && getMondayAESTKey() !== r.reportDate) void load();
    };
    const id = setInterval(check, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);


  const sections = report ? parseSections(report.content) : [];

  return (
    <div>
      {/* ── Sub-header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block", flexShrink: 0, boxShadow: "0 0 6px rgba(0,204,122,0.7)" }} />
          <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--green)", fontWeight: 700, letterSpacing: "0.06em" }}>LIVE REPORT</span>
          {report && (
            <>
              <span style={{ color: "var(--line-hi)", fontSize: 10 }}>·</span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
                w/c {new Date(report.reportDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              {report.fetchedAt && (
                <>
                  <span style={{ color: "var(--line-hi)", fontSize: 10 }}>·</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
                    cached {new Date(report.fetchedAt).toLocaleString("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "short", timeStyle: "short" })}
                  </span>
                </>
              )}
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => { void load(false, true); }}
            disabled={loading}
            title="Pull the latest report from OneDrive and refresh the server cache"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 5,
              background: "var(--sub)", border: "1px solid var(--line-hi)",
              color: "var(--ink-2)", fontSize: 11, cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.5 : 1, transition: "opacity 0.15s",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M13 8A5 5 0 1 1 8 3h3.5M11.5 3v3.5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Refresh
          </button>
          <button
            type="button"
            onClick={() => { setShowDebug(o => !o); void load(true); }}
            disabled={loading}
            title="Fetch with diagnostics"
            style={{
              padding: "6px 10px", borderRadius: 5,
              background: showDebug ? "rgba(77,156,245,0.1)" : "var(--sub)",
              border: `1px solid ${showDebug ? "rgba(77,156,245,0.35)" : "var(--line-hi)"}`,
              color: showDebug ? "#4d9cf5" : "var(--ink-3)", fontSize: 10.5, cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            Debug
          </button>
        </div>
      </div>

      {/* ── States ── */}
      {loading && (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ display: "block", margin: "0 auto 12px", opacity: 0.5, animation: "spin 1.1s linear infinite" }}>
            <path d="M13 8A5 5 0 1 1 8 3h3.5M11.5 3v3.5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Loading report…
        </div>
      )}

      {!loading && error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            background: "rgba(240,58,87,0.06)", border: "1px solid rgba(240,58,87,0.2)",
            borderRadius: 8, padding: "24px 32px", textAlign: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v6M10 13.5v1" stroke="var(--red)" strokeWidth="1.6" strokeLinecap="round"/><circle cx="10" cy="10" r="8.5" stroke="var(--red)" strokeWidth="1.2"/></svg>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--red)" }}>Could not load report</p>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{error}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button type="button" onClick={() => { void load(); }}
                style={{ padding: "7px 18px", borderRadius: 5, background: "var(--sub)", border: "1px solid var(--line-hi)", color: "var(--ink-1)", fontSize: 12, cursor: "pointer" }}>
                Try again
              </button>
              <button type="button" onClick={() => { void load(true); }}
                style={{ padding: "7px 14px", borderRadius: 5, background: "var(--sub)", border: "1px solid rgba(77,156,245,0.3)", color: "#4d9cf5", fontSize: 12, cursor: "pointer" }}>
                Diagnose
              </button>
            </div>
          </div>

          {debugLog && (
            <div style={{ background: "var(--card)", border: "1px solid var(--line-hi)", borderRadius: 7, padding: "14px 18px" }}>
              <p style={{ margin: "0 0 8px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", color: "var(--ink-3)", textTransform: "uppercase" }}>Diagnostic log</p>
              <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {debugLog.join("\n")}
              </pre>
            </div>
          )}
        </div>
      )}

      {!loading && report && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Source path chip */}
          <div style={{ marginBottom: 6 }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-3)",
              background: "var(--sub)", border: "1px solid var(--line)", borderRadius: 4,
              padding: "2px 8px",
            }}>
              OneDrive · Reports / {report.filename}
            </span>
          </div>

          {sections.map((s, i) => (
            <SectionCard key={i} section={s} />
          ))}
        </div>
      )}
    </div>
  );
}
