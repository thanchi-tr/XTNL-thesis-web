import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign-in Error | XTNL" };

/* ── Map next-auth error codes to human messages ─────────── */
const ERRORS: Record<string, { headline: string; detail: string }> = {
  Configuration: {
    headline: "Server configuration error",
    detail:   "There is a problem with the authentication configuration. Contact the XTNL administrator.",
  },
  AccessDenied: {
    headline: "Access denied",
    detail:   "Your account does not have permission to access XTNL Sovereign Trust. Authorised personnel only.",
  },
  OAuthSignin: {
    headline: "Microsoft sign-in failed",
    detail:   "Could not initiate the Microsoft sign-in flow. Please try again or contact the administrator.",
  },
  OAuthCallback: {
    headline: "Microsoft callback error",
    detail:   "Microsoft returned an error during authentication. This can happen if the session expired — please try again.",
  },
  OAuthAccountNotLinked: {
    headline: "Account not linked",
    detail:   "This Microsoft account is already associated with a different sign-in method.",
  },
  Default: {
    headline: "Authentication failed",
    detail:   "An unexpected error occurred during sign-in. Please try again.",
  },
};

/* In Next.js 15 App Router, searchParams is a Promise */
export default async function SignErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
  const { error: code, error_description } = await searchParams;
  const { headline, detail } = ERRORS[code ?? ""] ?? ERRORS.Default;

  return (
    <main
      style={{
        minHeight: "calc(100vh - var(--nav-h) - var(--bar-h))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 0 }}>

        {/* ── Error badge ───────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--red-10)", border: "1px solid rgba(240,58,87,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 5v4M8 11h.01" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="8" r="7" stroke="var(--red)" strokeWidth="1.2"/>
            </svg>
          </div>
          <span className="section-eyebrow" style={{ color: "var(--red)", letterSpacing: "0.10em" }}>
            Sign-in error
          </span>
        </div>

        {/* ── Card ──────────────────────────────────────────── */}
        <div
          className="card"
          style={{ padding: "28px 26px", borderLeft: "3px solid var(--red)" }}
        >
          {/* XTNL logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
            <svg width="15" height="15" viewBox="0 0 80 80" fill="none" aria-hidden>
              <path d="M24,0 L0,0 L0,80 L24,80"  stroke="var(--ink-3)" strokeWidth="5" strokeLinecap="square"/>
              <path d="M56,0 L80,0 L80,80 L56,80" stroke="var(--green)" strokeWidth="5" strokeLinecap="square"/>
              <line x1="22" y1="22" x2="58" y2="58" stroke="var(--blue)"  strokeWidth="5" strokeLinecap="square"/>
              <line x1="58" y1="22" x2="22" y2="58" stroke="var(--card)"  strokeWidth="9" strokeLinecap="square"/>
              <line x1="58" y1="22" x2="22" y2="58" stroke="white"        strokeWidth="5" strokeLinecap="square"/>
            </svg>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "var(--ink-0)" }}>
              XTNL
            </span>
          </div>

          <h1
            style={{
              fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em",
              color: "var(--ink-0)", marginBottom: 8, lineHeight: 1.3,
            }}
          >
            {headline}
          </h1>

          <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 24 }}>
            {detail}
          </p>

          {/* Error detail from Microsoft / next-auth */}
          {(code || error_description) && (
            <div
              style={{
                marginBottom: 24,
                padding: "10px 12px",
                background: "var(--sub)",
                border: "1px solid var(--line)",
                borderRadius: 5,
                display: "flex", flexDirection: "column", gap: 6,
              }}
            >
              {code && (
                <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)" }}>
                  Error: {code}
                </span>
              )}
              {error_description && (
                <span style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.55 }}>
                  {decodeURIComponent(error_description)}
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link
              href="/"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: 13 }}
            >
              Try signing in again
            </Link>
            <a
              href="mailto:xt@xtnl-solutions.com"
              className="btn btn-ghost"
              style={{ width: "100%", justifyContent: "center", padding: "11px", fontSize: 12 }}
            >
              Contact administrator
            </a>
          </div>
        </div>

        {/* Footer note */}
        <p style={{ marginTop: 16, fontSize: 11, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.6 }}>
          Restricted access · XTNL Sovereign Trust
        </p>
      </div>
    </main>
  );
}
