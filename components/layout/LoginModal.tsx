"use client";

import {
  useState, useRef, useEffect, useCallback,
  FormEvent, KeyboardEvent,
} from "react";
import XtnlLogo from "@/components/ui/XtnlLogo";
import { signIn, useSession } from "next-auth/react";

/* ═══════════════════════════════════════════════════════════
   OTP digit row
   ═══════════════════════════════════════════════════════════ */
function OtpInput({
  value, onChange, error, disabled,
}: {
  value: string; onChange: (v: string) => void; error: boolean; disabled?: boolean;
}) {
  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const r4 = useRef<HTMLInputElement>(null);
  const r5 = useRef<HTMLInputElement>(null);
  const refs = [r0, r1, r2, r3, r4, r5];

  /* Focus first box when entering this step */
  useEffect(() => { r0.current?.focus(); }, []);

  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  function set(i: number, char: string) {
    const next = digits.map((d, idx) => (idx === i ? char : d)).join("");
    onChange(next.replace(/\s/g, ""));
    if (char && i < 5) refs[i + 1].current?.focus();
  }

  function handleKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!digits[i] && i > 0) {
        const next = digits.map((d, idx) => (idx === i - 1 ? "" : d)).join("");
        onChange(next);
        refs[i - 1].current?.focus();
      } else {
        set(i, "");
      }
    } else if (e.key === "ArrowLeft"  && i > 0) refs[i - 1].current?.focus();
    else if   (e.key === "ArrowRight" && i < 5) refs[i + 1].current?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste) { onChange(paste); refs[Math.min(paste.length - 1, 5)].current?.focus(); }
    e.preventDefault();
  }

  return (
    <div style={{ display: "flex", gap: 7 }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={e => set(i, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          aria-label={`Digit ${i + 1}`}
          style={{
            flex: 1, minWidth: 0,
            height: 50,
            textAlign: "center",
            background: "var(--sub)",
            border: `1px solid ${error ? "var(--red)" : "var(--line-hi)"}`,
            borderRadius: 6,
            color: error ? "var(--red)" : "var(--ink-0)",
            fontSize: 20, fontWeight: 700,
            fontFamily: "var(--font-mono), monospace",
            outline: "none",
            transition: "border-color 0.15s, box-shadow 0.15s",
            opacity: disabled ? 0.5 : 1,
          }}
          onFocus={e => {
            if (!error && !disabled) {
              e.currentTarget.style.borderColor = "var(--green)";
              e.currentTarget.style.boxShadow  = "0 0 0 2px rgba(0,204,122,0.15)";
            }
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = error ? "var(--red)" : "var(--line-hi)";
            e.currentTarget.style.boxShadow  = "none";
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Spinner
   ═══════════════════════════════════════════════════════════ */
function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden
      style={{ animation: "spin-lm 0.7s linear infinite", flexShrink: 0 }}
    >
      <style>{`@keyframes spin-lm { to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5"/>
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Microsoft logo (4-square)
   ═══════════════════════════════════════════════════════════ */
function MsLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" aria-hidden>
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   XTNL logo mark (small)
   ═══════════════════════════════════════════════════════════ */
function LogoBar() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
      <XtnlLogo width="16" height="16" />
      <span className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "var(--ink-0)" }}>
        XTNL
      </span>
      <span className="mono" style={{
        fontSize: 7.5, letterSpacing: "0.10em", color: "var(--ink-3)",
        paddingLeft: 8, borderLeft: "1px solid var(--line)",
      }}>
        SOLUTIONS
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Tab pill
   ═══════════════════════════════════════════════════════════ */
type TotpTab = "qr" | "code";

function Tabs({ active, onChange }: { active: TotpTab; onChange: (t: TotpTab) => void }) {
  return (
    <div style={{
      display: "flex", gap: 4,
      background: "var(--sub)", border: "1px solid var(--line)",
      borderRadius: 7, padding: 3, marginBottom: 18,
    }}>
      {(["qr", "code"] as TotpTab[]).map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          style={{
            flex: 1, padding: "7px 0", borderRadius: 5,
            border: active === t ? "1px solid var(--line-hi)" : "1px solid transparent",
            cursor: "pointer", fontSize: 11.5, fontWeight: 600,
            letterSpacing: "0.04em",
            background: active === t ? "var(--raised)" : "transparent",
            color: active === t ? "var(--ink-0)" : "var(--ink-2)",
            transition: "all 0.15s",
          }}
        >
          {t === "qr" ? "Scan QR code" : "Enter code"}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main modal
   ═══════════════════════════════════════════════════════════ */
type Step = "sign-in" | "totp";

export default function LoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: session, update } = useSession();

  const [step,       setStep]       = useState<Step>("sign-in");
  const [tab,        setTab]        = useState<TotpTab>("qr");
  const [enrolled,   setEnrolled]   = useState<boolean | null>(null); // null = not yet fetched
  const [otp,        setOtp]        = useState("");
  const [otpError,   setOtpError]   = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [msLoading,  setMsLoading]  = useState(false);
  const [msError,    setMsError]    = useState<string | null>(null);
  const [qrUrl,      setQrUrl]      = useState<string | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);

  /* When session exists but 2FA not yet done → jump to totp step */
  useEffect(() => {
    if (session && !session.twoFactorVerified) {
      setStep("totp");
    }
  }, [session]);

  /* On entering the totp step, fetch enrollment status + QR (first-timers only) */
  useEffect(() => {
    if (step !== "totp" || enrolled !== null) return;
    setTotpLoading(true);
    fetch("/api/auth/totp")
      .then(r => r.json())
      .then((d: { enrolled: boolean; qrDataUrl?: string }) => {
        setEnrolled(d.enrolled);
        if (d.enrolled) {
          /* Returning user — force code tab, no QR */
          setTab("code");
        } else {
          /* First-timer — show QR tab and store QR URL */
          setTab("qr");
          if (d.qrDataUrl) setQrUrl(d.qrDataUrl);
        }
      })
      .finally(() => setTotpLoading(false));
  }, [step, enrolled]);

  /* Lock body scroll; listen for ESC */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleEsc = useCallback((e: globalThis.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, handleEsc]);

  /* Reset transient state on close */
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        if (!session?.twoFactorVerified) setStep("sign-in");
        setOtp(""); setOtpError(false); setMsLoading(false); setOtpLoading(false);
        setMsError(null); setEnrolled(null); setQrUrl(null);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, session]);

  /* ── Actions ─────────────────────────────────────────── */
  async function handleMicrosoft() {
    setMsLoading(true);
    setMsError(null);
    try {
      /* No redirectTo — lets next-auth route errors to pages.error (/sign-error)
         rather than appending ?error= to the current URL.
         On success, NavBar's useSession detects the new session and opens 2FA. */
      await signIn("microsoft-entra-id");
    } catch {
      setMsError("Could not reach Microsoft. Check your connection and try again.");
      setMsLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    const code = otp.replace(/\D/g, "");
    if (code.length < 6) { setOtpError(true); return; }

    setOtpLoading(true); setOtpError(false);
    try {
      const res  = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json() as { valid: boolean };

      if (data.valid) {
        await update({ twoFactorVerified: true });
        onClose();
      } else {
        setOtpError(true);
        setOtp("");
      }
    } finally {
      setOtpLoading(false);
    }
  }

  /* ═══════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Backdrop ───────────────────────────────────── */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 199,
          background: "rgba(2,5,8,0.82)",
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.24s ease",
        }}
      />

      {/* ── Scroll-lock wrapper ─────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px 20px",
          overflow: "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* ── Card ───────────────────────────────────────── */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 376,
            maxHeight: "calc(100svh - 48px)",
            background: "var(--card)",
            border: "1px solid var(--line-hi)",
            borderRadius: 10,
            padding: "28px 26px 24px",
            boxShadow: "var(--shadow-lg)",
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "none",
            transform: open ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
            opacity: open ? 1 : 0,
            transition: "transform 0.27s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease",
            position: "relative",
          }}
        >
          {/* ── Close ────────────────────────────────────── */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute", top: 14, right: 14,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--ink-3)", padding: 4, lineHeight: 0,
              borderRadius: 4, transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--ink-1)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-3)")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>

          <LogoBar />

          {/* ══════════════════════════════════════════════
              STEP 1 — Sign in with Microsoft
          ══════════════════════════════════════════════ */}
          {step === "sign-in" && (
            <>
              <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink-0)", marginBottom: 4 }}>
                Sign in
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 22 }}>
                Restricted to authorised work accounts.
              </p>

              {/* Microsoft button */}
              <button
                onClick={handleMicrosoft}
                disabled={msLoading}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "13px 16px",
                  background: "var(--sub)", border: "1px solid var(--line-hi)",
                  borderRadius: 7, cursor: msLoading ? "not-allowed" : "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                  opacity: msLoading ? 0.6 : 1,
                  textAlign: "left",
                }}
                onMouseEnter={e => {
                  if (!msLoading) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line-act)";
                    (e.currentTarget as HTMLButtonElement).style.background  = "var(--raised)";
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line-hi)";
                  (e.currentTarget as HTMLButtonElement).style.background  = "var(--sub)";
                }}
              >
                <span style={{ lineHeight: 0, flexShrink: 0 }}>
                  {msLoading ? <Spinner size={18} /> : <MsLogo />}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-0)", lineHeight: 1.3 }}>
                    Continue with Microsoft
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                    Outlook · Microsoft 365
                  </span>
                </span>
                {!msLoading && (
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden style={{ color: "var(--ink-3)", flexShrink: 0 }}>
                    <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              {/* Inline error (network / pre-redirect failure) */}
              {msError && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    background: "var(--red-10)",
                    border: "1px solid rgba(240,58,87,0.25)",
                    borderRadius: 6,
                    display: "flex", alignItems: "flex-start", gap: 8,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M8 5v4M8 11h.01" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="8" cy="8" r="7" stroke="var(--red)" strokeWidth="1.2"/>
                  </svg>
                  <p style={{ fontSize: 11.5, color: "var(--red)", lineHeight: 1.55, margin: 0 }}>{msError}</p>
                </div>
              )}

              <p style={{ marginTop: 20, fontSize: 11, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.6 }}>
                Authorised personnel only · XTNL Solutions
              </p>
            </>
          )}

          {/* ══════════════════════════════════════════════
              STEP 2 — TOTP 2FA
          ══════════════════════════════════════════════ */}
          {step === "totp" && (
            <form onSubmit={handleVerify} noValidate>
              <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink-0)", marginBottom: 4 }}>
                Verify your identity
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 18 }}>
                {enrolled === false
                  ? "Set up Microsoft Authenticator to complete sign-in."
                  : "Enter your Microsoft Authenticator code to continue."}
              </p>

              {/* ── Loading enrollment status ───────────── */}
              {totpLoading && (
                <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                  <Spinner size={22} />
                </div>
              )}

              {/* ── First-time user: QR setup + code tabs ─ */}
              {!totpLoading && enrolled === false && (
                <>
                  <Tabs active={tab} onChange={t => { setTab(t); setOtp(""); setOtpError(false); }} />

                  {tab === "qr" && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                      <p style={{ fontSize: 12, color: "var(--ink-2)", textAlign: "center", lineHeight: 1.55 }}>
                        Open Microsoft Authenticator → Add account → Scan QR code.
                      </p>
                      <div style={{
                        background: "#fff", borderRadius: 8, padding: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 148, height: 148, flexShrink: 0,
                      }}>
                        {qrUrl ? (
                          <img src={qrUrl} width={128} height={128} alt="Scan with Microsoft Authenticator" style={{ display: "block", imageRendering: "pixelated" }} />
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>QR unavailable</span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.55 }}>
                        After scanning, switch to{" "}
                        <button type="button" onClick={() => setTab("code")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--green)", fontSize: 11, padding: 0 }}>
                          Enter code
                        </button>
                        {" "}to complete setup.
                      </p>
                    </div>
                  )}

                  {tab === "code" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
                        Enter the 6-digit code from Microsoft Authenticator to finish setup.
                      </p>
                      <OtpInput value={otp} onChange={v => { setOtp(v); setOtpError(false); }} error={otpError} disabled={otpLoading} />
                      {otpError && <p style={{ fontSize: 11.5, color: "var(--red)", marginTop: -4 }}>Incorrect code. Try again.</p>}
                      <button type="submit" className="btn btn-primary" disabled={otpLoading || otp.replace(/\D/g, "").length < 6} style={{ width: "100%", padding: "12px", fontSize: 13, marginTop: 4 }}>
                        {otpLoading ? <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}><Spinner /> Verifying…</span> : "Complete setup"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── Returning user: code entry only ──────── */}
              {!totpLoading && enrolled === true && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
                    Enter the 6-digit code shown in Microsoft Authenticator.
                  </p>
                  <OtpInput value={otp} onChange={v => { setOtp(v); setOtpError(false); }} error={otpError} disabled={otpLoading} />
                  {otpError && <p style={{ fontSize: 11.5, color: "var(--red)", marginTop: -4 }}>Incorrect code. Try again.</p>}
                  <button type="submit" className="btn btn-primary" disabled={otpLoading || otp.replace(/\D/g, "").length < 6} style={{ width: "100%", padding: "12px", fontSize: 13, marginTop: 4 }}>
                    {otpLoading ? <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}><Spinner /> Verifying…</span> : "Authenticate"}
                  </button>
                </div>
              )}

              {/* Footer */}
              <p style={{ marginTop: 20, fontSize: 11, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.6 }}>
                Need help?{" "}
                <a href="mailto:xt@xtnl-solutions.com" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
                  Contact administrator
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
