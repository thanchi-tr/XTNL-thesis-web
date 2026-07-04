"use client";

import { useState, useEffect } from "react";
import { useSession }          from "next-auth/react";
import { useSearchParams }     from "next/navigation";
import { Suspense }            from "react";

function WatchAuthInner() {
  const { data: session, status } = useSession();
  const params                    = useSearchParams();
  const deviceCode                = params.get("code") ?? "";

  const [phase, setPhase]   = useState<"loading" | "unauthorized" | "ready" | "authorizing" | "done" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authed = !!(session as any)?.twoFactorVerified;

  useEffect(() => {
    if (status === "loading") return;
    if (!authed) { setPhase("unauthorized"); return; }
    if (!deviceCode) { setPhase("error"); setErrMsg("No device code in URL."); return; }
    setPhase("ready");
  }, [status, authed, deviceCode]);

  async function handleAuthorize() {
    setPhase("authorizing");
    try {
      const res = await fetch("/api/watch/device-auth/authorize", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ deviceCode }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setPhase("done");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Unknown error");
      setPhase("error");
    }
  }

  const center: React.CSSProperties = {
    minHeight: "100dvh", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    background: "#04080f", color: "#e8eaf0", fontFamily: "var(--font-mono, monospace)",
    gap: 24, padding: "32px 24px",
  };
  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 12, padding: "32px 28px", maxWidth: 380, width: "100%",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
  };
  const btn: React.CSSProperties = {
    width: "100%", padding: "14px 0", borderRadius: 8, border: "none",
    background: "rgba(0,204,122,0.15)", color: "#00cc7a",
    fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <div style={center}>
      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.15em", color: "#00cc7a" }}>XTNL</div>
        <div style={{ fontSize: 9, letterSpacing: "0.22em", color: "rgba(255,255,255,0.3)", marginTop: 2 }}>SOVEREIGN TRUST</div>
      </div>

      <div style={card}>
        {/* Watch icon */}
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="13" y="8" width="14" height="24" rx="4" stroke="rgba(0,204,122,0.6)" strokeWidth="1.5"/>
          <circle cx="20" cy="20" r="5.5" stroke="rgba(0,204,122,0.6)" strokeWidth="1.5"/>
          <path d="M20 17v3l2 2" stroke="#00cc7a" strokeWidth="1.3" strokeLinecap="round"/>
          <rect x="16" y="4" width="8" height="4" rx="1" fill="rgba(0,204,122,0.25)"/>
          <rect x="16" y="32" width="8" height="4" rx="1" fill="rgba(0,204,122,0.25)"/>
        </svg>

        {phase === "loading" && (
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>Checking session…</p>
        )}

        {phase === "unauthorized" && (
          <>
            <p style={{ margin: 0, fontSize: 13, color: "#f03a57", letterSpacing: "0.03em", textAlign: "center" }}>
              Authentication required
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 1.6 }}>
              Please log into XTNL on your phone, then scan the QR code on your watch again.
            </p>
            <a href={`/login?callbackUrl=${encodeURIComponent(`/watch-auth?code=${deviceCode}`)}`}
              style={{ ...btn, textDecoration: "none", display: "block", textAlign: "center" }}>
              LOG IN
            </a>
          </>
        )}

        {phase === "ready" && (
          <>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>DEVICE CODE</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "0.2em", color: "#00cc7a" }}>
                {deviceCode.replace("XTNL-", "")}
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.65 }}>
              Authorize your Galaxy Watch to access the XTNL Focus Alarm. Session expires at 2:00 AM AEST.
            </p>
            <button onClick={handleAuthorize} style={btn}>AUTHORIZE WATCH</button>
          </>
        )}

        {phase === "authorizing" && (
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>Authorizing…</p>
        )}

        {phase === "done" && (
          <>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="20" stroke="rgba(0,204,122,0.4)" strokeWidth="1.5"/>
              <path d="M13 22l6 6 12-12" stroke="#00cc7a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#00cc7a" }}>Watch Authorized</p>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                Your Galaxy Watch is now connected. You can close this page. The watch will update automatically.
              </p>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <p style={{ margin: 0, fontSize: 12, color: "#f03a57" }}>{errMsg || "Something went wrong."}</p>
            <button onClick={() => window.location.reload()} style={{ ...btn, background: "rgba(240,58,87,0.12)", color: "#f03a57" }}>
              RETRY
            </button>
          </>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>
        XTNL SOVEREIGN TRUST · WATCH COMPANION
      </p>
    </div>
  );
}

export default function WatchAuthPage() {
  return (
    <Suspense>
      <WatchAuthInner />
    </Suspense>
  );
}
