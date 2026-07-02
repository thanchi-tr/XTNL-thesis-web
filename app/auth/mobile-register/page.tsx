"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams }              from "next/navigation";
import XtnlLogo                        from "@/components/ui/XtnlLogo";

type Phase = "loading" | "ready" | "scanning" | "success" | "error" | "expired";

export default function MobileRegisterPage() {
  const params = useSearchParams();
  const token  = params.get("t");

  const [phase,   setPhase]   = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (!token) { setPhase("expired"); return; }
    setPhase("ready");
  }, [token]);

  async function runRegistration() {
    if (started.current || !token) return;
    started.current = true;
    setPhase("scanning");
    setMessage("");

    try {
      /* 1 — fetch registration options */
      const optRes  = await fetch(`/api/auth/mobile-challenge?token=${encodeURIComponent(token)}&action=reg-options`);
      const optData = await optRes.json() as Record<string, unknown>;
      if ((optData as { status?: string }).status === "expired") { setPhase("expired"); return; }

      /* 2 — phone biometric registration */
      const { startRegistration } = await import("@simplewebauthn/browser");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const credential = await startRegistration(optData as any);

      /* 3 — submit to server */
      const verRes  = await fetch(`/api/auth/mobile-challenge?token=${encodeURIComponent(token)}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(credential),
      });
      const verData = await verRes.json() as { verified?: boolean; error?: string };

      if (verData.verified) {
        setPhase("success");
      } else {
        started.current = false;
        setPhase("error");
        setMessage(verData.error ?? "Registration failed. Please try again.");
      }
    } catch (e: unknown) {
      started.current = false;
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("NotAllowed") || msg.includes("cancel") || msg.includes("abort")) {
        setPhase("ready");
        setMessage("Registration was cancelled. Tap the button to try again.");
      } else if (msg.includes("InvalidState") || msg.includes("already")) {
        setPhase("success"); // credential already exists — treat as done
      } else {
        setPhase("error");
        setMessage("Could not register biometric. Make sure your phone has biometrics enabled in Settings.");
      }
    }
  }

  return (
    <div style={{
      minHeight:      "100dvh",
      background:     "#04080f",
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      padding:        "32px 24px",
      fontFamily:     "var(--font-sans, system-ui, sans-serif)",
    }}>
      <div style={{
        width: "100%", maxWidth: 380,
        background:   "rgba(255,255,255,0.035)",
        border:       "1px solid rgba(0,204,122,0.18)",
        borderRadius: 16,
        padding:      "40px 32px",
        display:      "flex", flexDirection: "column", alignItems: "center",
        gap: 24, textAlign: "center",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <XtnlLogo width="22" height="22" style={{ filter: "drop-shadow(0 0 6px rgba(0,204,122,0.5))" }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", color: "#e8f0f8", fontVariantCaps: "all-small-caps" }}>XTNL</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", paddingLeft: 8, borderLeft: "1px solid rgba(255,255,255,0.1)" }}>SOLUTIONS</span>
        </div>

        {phase === "loading" && (
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>Preparing…</p>
        )}

        {phase === "expired" && (
          <>
            <div style={{ fontSize: 36 }}>⏱</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#e8f0f8", margin: 0 }}>Link expired</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, margin: 0 }}>
              This registration link has expired. Go back to your desktop and scan a new QR code.
            </p>
          </>
        )}

        {(phase === "ready" || (phase === "error" && message)) && (
          <>
            {/* Shield / add icon */}
            <div style={{ position: "relative", width: 72, height: 72 }}>
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden>
                <circle cx="36" cy="36" r="34" stroke="rgba(0,204,122,0.2)" strokeWidth="1.5"/>
                <path d="M36 16c0 0-14 6-14 20v10l14 8 14-8V36c0-14-14-20-14-20z" stroke="rgba(0,204,122,0.55)" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M29 36l4.5 4.5L43 30" stroke="rgba(0,204,122,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px #00cc7a)" }}/>
              </svg>
            </div>

            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#e8f0f8", margin: "0 0 8px" }}>
                Register biometric
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: 0 }}>
                Tap the button to register this phone&apos;s biometric (fingerprint or Face ID) as a sign-in key for XTNL Solutions.
              </p>
            </div>

            {message && (
              <p style={{ fontSize: 12.5, color: "#ff6b6b", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 7, padding: "10px 14px", margin: 0, lineHeight: 1.55 }}>
                {message}
              </p>
            )}

            <button
              onClick={runRegistration}
              style={{
                width: "100%", padding: "14px",
                background:   "rgba(0,204,122,0.12)",
                border:       "1px solid rgba(0,204,122,0.4)",
                borderRadius: 9,
                color:        "#00cc7a", fontSize: 14, fontWeight: 600,
                cursor: "pointer", letterSpacing: "0.02em",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,204,122,0.22)"; }}
              onTouchEnd={e =>   { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,204,122,0.12)"; }}
            >
              Register with biometric
            </button>

            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: 0, lineHeight: 1.5 }}>
              Your biometric data never leaves this device.<br/>
              Only a cryptographic key is stored on the server.
            </p>
          </>
        )}

        {phase === "scanning" && (
          <>
            <div style={{ position: "relative", width: 64, height: 64 }}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
                <circle cx="32" cy="32" r="30" stroke="rgba(0,204,122,0.15)" strokeWidth="2"/>
                <circle cx="32" cy="32" r="30" stroke="rgba(0,204,122,0.7)" strokeWidth="2"
                  strokeDasharray="60 130" strokeLinecap="round"
                  style={{ transformOrigin: "32px 32px", animation: "spin 1.1s linear infinite" }}/>
              </svg>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 600, color: "#e8f0f8", margin: "0 0 8px" }}>
                Waiting for biometric…
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, margin: 0 }}>
                Use your fingerprint or Face ID to register this device.
              </p>
            </div>
          </>
        )}

        {phase === "success" && (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(0,204,122,0.12)", border: "1px solid rgba(0,204,122,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              filter: "drop-shadow(0 0 10px rgba(0,204,122,0.35))",
            }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
                <path d="M5 14l6.5 6.5L23 7" stroke="#00cc7a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#00cc7a", margin: "0 0 8px" }}>Phone registered</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0 }}>
                This phone is now a biometric key for XTNL Solutions.
                Return to your desktop — it should now show as verified.
              </p>
            </div>
          </>
        )}

        {phase === "error" && !message && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
                <path d="M11 4v7M11 14.5v1" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#ff6b6b", margin: "0 0 8px" }}>Registration failed</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, margin: 0 }}>
                Please return to your desktop and scan the QR code again.
              </p>
            </div>
          </>
        )}

        <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>
          XTNL Solutions · Secure registration
        </p>
      </div>
    </div>
  );
}
