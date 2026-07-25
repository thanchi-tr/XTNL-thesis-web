"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { parseFrictionReport, type FrictionReport } from "@/lib/frictionReport";
import FrictionPanel from "@/components/session/FrictionPanel";

/**
 * Opens the latest LLM auditor report (live.audit.txt from OneDrive, via the
 * same /api/session/audit-report route the session page's operator "Mirror ·
 * LLM Audit" tab already uses) in a modal. Self-contained: fetches on click,
 * shows its own loading/error state, no page-level wiring needed.
 */
export default function AuditReportButton() {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [report,  setReport]  = useState<FrictionReport | null>(null);

  const handleOpen = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/session/audit-report");
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Failed to fetch audit report");
      const text = await r.text();
      setReport(parseFrictionReport(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audit report");
    }
    setLoading(false);
  }, []);

  return (
    <>
      <button className="btn btn-secondary" onClick={handleOpen}>
        Audit Report
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            padding: "48px 20px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 760,
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              boxShadow: "0 8px 56px rgba(0,0,0,0.72)",
              padding: 28,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <p className="section-eyebrow" style={{ margin: 0 }}>Latest LLM Auditor Report</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 18, lineHeight: 1, padding: 4 }}
              >
                ✕
              </button>
            </div>

            {loading && (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                Loading audit report…
              </div>
            )}
            {!loading && error && (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--red)", fontSize: 13 }}>
                {error}
              </div>
            )}
            {!loading && !error && report && <FrictionPanel f={report} />}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
