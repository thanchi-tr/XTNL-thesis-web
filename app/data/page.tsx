import type { Metadata } from "next";
import { auth }          from "@/auth";
import DataClient        from "./DataClient";

export const metadata: Metadata = { title: "Data" };

/* ── Locked / public view ─────────────────────────────────────
   Shown to any visitor without a verified session.
   Contains no strategy metrics, logic, or executable edge detail.     */
function LockedDataPage() {
  return (
    <div className="site-container" style={{ paddingTop: 64, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ maxWidth: 680, marginBottom: 64 }}>
        <p className="section-eyebrow" style={{ marginBottom: 14 }}>Performance Data</p>
        <h1 style={{
          fontSize: "clamp(26px, 4vw, 44px)",
          fontWeight: 800, letterSpacing: "-0.03em",
          color: "var(--ink-0)", marginBottom: 16, lineHeight: 1.1,
        }}>
          Live Track Record
        </h1>
        <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.8 }}>
          XTNL maintains a verifiable, pipeline-generated performance record updated
          each week from live execution. The full dataset — including regime metrics,
          system health grades, and inferred statistics — is available to verified
          participants only.
        </p>
      </div>

      {/* Locked card */}
      <div style={{
        maxWidth: 520,
        background: "var(--card)",
        border: "1px solid var(--line-hi)",
        borderRadius: 12,
        padding: "40px 36px",
        display: "flex", flexDirection: "column", gap: 24,
      }}>
        {/* Lock icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "rgba(77,156,245,0.08)",
            border: "1px solid rgba(77,156,245,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="20" viewBox="0 0 18 20" fill="none" aria-hidden>
              <rect x="2" y="9" width="14" height="10" rx="2.5" stroke="rgba(77,156,245,0.8)" strokeWidth="1.4"/>
              <path d="M5 9V6a4 4 0 0 1 8 0v3" stroke="rgba(77,156,245,0.8)" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="9" cy="14" r="1.5" fill="rgba(77,156,245,0.8)"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink-0)" }}>Restricted access</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
              Sign in with your verified XTNL account to view the live report.
            </p>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--line)" }} />

        {/* What's inside — non-revealing bullets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "Pipeline-generated metrics refreshed every session",
            "Regime-conditioned system health assessment",
            "Weekly aggregated statistics across all active subsets",
            "Inferred performance indicators from live execution",
          ].map((text, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                <circle cx="7" cy="7" r="6" stroke="rgba(77,156,245,0.3)" strokeWidth="1"/>
                <path d="M4.5 7l1.8 1.8L9.5 5" stroke="rgba(77,156,245,0.7)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>{text}</span>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: "var(--line)" }} />

        <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.6 }}>
          Access is limited to XTNL participants. If you have an account,
          sign in using the button in the navigation bar.
        </p>
      </div>
    </div>
  );
}

/* ── Authenticated view ───────────────────────────────────── */
export default async function DataPage() {
  const session = await auth();
  const authed  = !!(session as { twoFactorVerified?: boolean } | null)?.twoFactorVerified;
  const roles   = (session as { roles?: string[] } | null)?.roles ?? [];
  const canView = authed && roles.some(r => ["analyst", "fund_manager"].includes(r));

  if (!canView) return <LockedDataPage />;

  return (
    <div className="site-container" style={{ paddingTop: 48, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ maxWidth: 700, marginBottom: 40 }}>
        <p className="section-eyebrow" style={{ marginBottom: 14 }}>Production Analytics</p>
        <h1 style={{
          fontSize: "clamp(24px, 4vw, 44px)",
          fontWeight: 800, letterSpacing: "-0.03em",
          color: "var(--ink-0)", marginBottom: 16, lineHeight: 1.1,
        }}>
          System Performance Data
        </h1>
        <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.8 }}>
          Live metrics pulled directly from the XTNL analytics pipeline on OneDrive.
          The report below reflects the latest <code style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--ink-1)", background: "var(--sub)", padding: "1px 5px", borderRadius: 3 }}>.report.general.txt</code> generated by the pipeline.
        </p>
      </div>

      <DataClient />
    </div>
  );
}
