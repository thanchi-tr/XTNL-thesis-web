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
    <div style={{ display: "flex", gap: 8 }}>
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
            height: 52,
            textAlign: "center",
            background: d ? "var(--raised)" : "var(--sub)",
            backgroundImage: d ? "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, transparent 55%)" : "none",
            border: `1px solid ${error ? "var(--red)" : d ? "var(--line-act)" : "var(--line-hi)"}`,
            borderRadius: 7,
            color: error ? "var(--red)" : "var(--ink-0)",
            fontSize: 20, fontWeight: 700,
            fontFamily: "var(--font-mono), monospace",
            outline: "none",
            boxShadow: error
              ? "0 0 0 3px rgba(240,58,87,0.10)"
              : d ? "0 1px 0 rgba(255,255,255,0.03) inset, 0 2px 8px rgba(0,0,0,0.25)" : "none",
            transition: "border-color 0.16s, box-shadow 0.16s, background 0.16s, transform 0.12s",
            opacity: disabled ? 0.5 : 1,
          }}
          onFocus={e => {
            if (!error && !disabled) {
              e.currentTarget.style.borderColor = "var(--green)";
              e.currentTarget.style.boxShadow  = "0 0 0 3px rgba(0,204,122,0.14)";
              e.currentTarget.style.transform  = "translateY(-1px)";
            }
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = error ? "var(--red)" : d ? "var(--line-act)" : "var(--line-hi)";
            e.currentTarget.style.boxShadow  = error ? "0 0 0 3px rgba(240,58,87,0.10)" : d ? "0 1px 0 rgba(255,255,255,0.03) inset, 0 2px 8px rgba(0,0,0,0.25)" : "none";
            e.currentTarget.style.transform  = "translateY(0)";
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
      <rect x="1"  y="1"  width="9" height="9" rx="0.5" fill="#f25022"/>
      <rect x="11" y="1"  width="9" height="9" rx="0.5" fill="#7fba00"/>
      <rect x="1"  y="11" width="9" height="9" rx="0.5" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" rx="0.5" fill="#ffb900"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Animated success check — draws the stroke in rather than
   popping in flat, used for "verified" states throughout.
   ═══════════════════════════════════════════════════════════ */
function CheckGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="6.3" stroke="var(--green)" strokeWidth="1" opacity="0.28"/>
      <path
        d="M2.5 7l3.5 3.5L11.5 3"
        stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        pathLength={1}
        style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "auth-check-draw 0.42s 0.05s cubic-bezier(0.65,0,0.35,1) forwards" }}
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   XTNL logo mark (small)
   ═══════════════════════════════════════════════════════════ */
function LogoBar() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9, marginBottom: 26,
      animation: "auth-rise 0.4s cubic-bezier(0.16,1,0.3,1) both",
    }}>
      <span style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
        background: "rgba(0,204,122,0.08)", border: "1px solid rgba(0,204,122,0.22)",
      }}>
        <XtnlLogo width="14" height="14" />
      </span>
      <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.18em", color: "var(--ink-0)" }}>
        XTNL
      </span>
      <span className="mono" style={{
        fontSize: 7.5, letterSpacing: "0.12em", color: "var(--ink-3)",
        paddingLeft: 9, borderLeft: "1px solid var(--line)",
      }}>
        SOLUTIONS
      </span>
      <span className="mono" style={{
        marginLeft: "auto", fontSize: 8.5, letterSpacing: "0.1em", color: "var(--ink-4, var(--ink-3))",
        padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)",
      }}>
        SECURE
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
      borderRadius: 8, padding: 3, marginBottom: 20,
    }}>
      {(["qr", "code"] as TotpTab[]).map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          style={{
            flex: 1, padding: "8px 0", borderRadius: 6,
            border: active === t ? "1px solid var(--line-hi)" : "1px solid transparent",
            cursor: "pointer", fontSize: 11.5, fontWeight: 600,
            letterSpacing: "0.03em",
            background: active === t ? "var(--raised)" : "transparent",
            boxShadow: active === t ? "0 2px 8px rgba(0,0,0,0.22)" : "none",
            color: active === t ? "var(--ink-0)" : "var(--ink-3)",
            transition: "background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s",
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
  const [totpLoading,    setTotpLoading]    = useState(false);
  const [passkeyStatus,  setPasskeyStatus]  = useState<"unknown" | "enrolled" | "none">("unknown");
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError,   setPasskeyError]   = useState<string | null>(null);
  const [showCodeEntry,  setShowCodeEntry]  = useState(false);

  /* Add-biometric panel */
  const [showAddBiometric, setShowAddBiometric] = useState(false);
  const [regQrUrl,    setRegQrUrl]    = useState<string | null>(null);
  const [regQrToken,  setRegQrToken]  = useState<string | null>(null);
  const [regQrStatus, setRegQrStatus] = useState<"idle"|"loading"|"polling"|"verified"|"expired"|"error">("idle");
  const regQrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* QR mobile-challenge flow */
  const [showQr,       setShowQr]       = useState(false);
  const [qrMobileUrl,  setQrMobileUrl]  = useState<string | null>(null);
  const [qrToken,      setQrToken]      = useState<string | null>(null);
  const [qrStatus,     setQrStatus]     = useState<"idle" | "loading" | "polling" | "verified" | "expired" | "error">("idle");
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* When session exists but 2FA not yet done → jump to totp step */
  useEffect(() => {
    if (session && !session.twoFactorVerified) {
      setStep("totp");
    }
  }, [session]);

  /* On entering the totp step, fetch TOTP enrollment + passkey status in parallel */
  useEffect(() => {
    if (step !== "totp" || enrolled !== null) return;
    setTotpLoading(true);
    Promise.all([
      fetch("/api/auth/totp").then(r => r.json())                        as Promise<{ enrolled: boolean; qrDataUrl?: string }>,
      fetch("/api/auth/webauthn?action=status").then(r => r.json())      as Promise<{ hasPasskey: boolean }>,
    ])
      .then(([totp, wn]) => {
        setEnrolled(totp.enrolled);
        setPasskeyStatus(wn.hasPasskey ? "enrolled" : "none");
        if (totp.enrolled) {
          setTab("code");
        } else {
          setTab("qr");
          if (totp.qrDataUrl) setQrUrl(totp.qrDataUrl);
        }
      })
      .catch(() => setPasskeyStatus("none"))
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
        setPasskeyStatus("unknown"); setPasskeyLoading(false); setPasskeyError(null); setShowCodeEntry(false);
        setShowAddBiometric(false);
        setRegQrUrl(null); setRegQrToken(null); setRegQrStatus("idle");
        if (regQrPollRef.current) { clearInterval(regQrPollRef.current); regQrPollRef.current = null; }
        setShowQr(false); setQrMobileUrl(null); setQrToken(null); setQrStatus("idle");
        if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, session]);

  /* ── Actions ─────────────────────────────────────────── */
  async function handleBiometricAuth() {
    setPasskeyLoading(true);
    setPasskeyError(null);
    try {
      const optRes = await fetch("/api/auth/webauthn?action=authenticate");
      if (!optRes.ok) throw new Error("server");
      const options = await optRes.json();
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const credential = await startAuthentication(options);
      const res  = await fetch("/api/auth/webauthn?action=authenticate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      const data = await res.json() as { verified: boolean };
      if (data.verified) { await update({ twoFactorVerified: true }); onClose(); }
      else setPasskeyError("Biometric verification failed. Use your code instead.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("NotAllowed") || msg.includes("cancel") || msg.includes("abort"))
        setPasskeyError("Biometric was cancelled. Try again or use your code.");
      else
        setPasskeyError("Biometric sign-in failed. Use your code instead.");
    } finally {
      setPasskeyLoading(false);
    }
  }

  async function handlePhoneRegisterQr() {
    setRegQrStatus("loading"); setRegQrUrl(null); setRegQrToken(null); setPasskeyError(null);
    if (regQrPollRef.current) { clearInterval(regQrPollRef.current); regQrPollRef.current = null; }
    try {
      const res  = await fetch("/api/auth/mobile-challenge?type=register", { method: "POST" });
      const data = await res.json() as { token?: string; qrDataUrl?: string; error?: string };
      if (!data.token || !data.qrDataUrl) { setRegQrStatus("error"); return; }
      setRegQrToken(data.token); setRegQrUrl(data.qrDataUrl); setRegQrStatus("polling");

      const token = data.token;
      regQrPollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`/api/auth/mobile-challenge?token=${token}&action=status`);
          const pd = await pr.json() as { status: "pending" | "verified" | "expired" };
          if (pd.status === "verified") {
            clearInterval(regQrPollRef.current!); regQrPollRef.current = null;
            setRegQrStatus("verified"); setPasskeyStatus("enrolled");
            /* Auto-close after 1.5 s so the user sees the success state */
            setTimeout(() => { setShowAddBiometric(false); setRegQrStatus("idle"); }, 1500);
          } else if (pd.status === "expired") {
            clearInterval(regQrPollRef.current!); regQrPollRef.current = null;
            setRegQrStatus("expired");
          }
        } catch { /* network hiccup */ }
      }, 2500);

      setTimeout(() => {
        if (regQrPollRef.current) {
          clearInterval(regQrPollRef.current); regQrPollRef.current = null;
          setRegQrStatus(s => s === "polling" ? "expired" : s);
        }
      }, 5 * 60_000);
    } catch {
      setRegQrStatus("error");
    }
  }

  async function handleBiometricSetup(attachment?: "cross-platform" | "platform") {
    if (attachment === "cross-platform") { handlePhoneRegisterQr(); return; }
    setPasskeyLoading(true);
    setPasskeyError(null);
    try {
      const url = `/api/auth/webauthn?action=register${attachment ? `&attachment=${attachment}` : ""}`;
      const optRes = await fetch(url);
      if (!optRes.ok) throw new Error("server");
      const options = await optRes.json();
      const { startRegistration } = await import("@simplewebauthn/browser");
      const credential = await startRegistration(options);
      const res  = await fetch("/api/auth/webauthn?action=register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      const data = await res.json() as { verified: boolean };
      if (data.verified) {
        setPasskeyStatus("enrolled");
        setShowAddBiometric(false);
        setPasskeyError(null);
        if (!session?.twoFactorVerified) { await update({ twoFactorVerified: true }); onClose(); }
      } else {
        setPasskeyError("Passkey setup failed. Please use your code to continue.");
      }
    } catch (e: unknown) {
      const name = e instanceof DOMException ? e.name : "";
      const msg  = e instanceof Error ? e.message : "";
      if (name === "NotAllowedError" || msg.includes("cancel") || msg.includes("abort")) {
        setPasskeyError("Setup cancelled. Try again when ready.");
      } else if (name === "InvalidStateError") {
        setPasskeyError("A passkey for this account already exists on this device.");
      } else if (name === "NotSupportedError") {
        setPasskeyError("This device doesn't support passkeys. Use your authenticator code.");
      } else {
        setPasskeyError(
          "Windows Hello setup failed. Your PC may not have a PIN or fingerprint configured " +
          "(Settings → Accounts → Sign-in options). Use Microsoft Authenticator on your phone instead."
        );
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  async function handleQrSignIn() {
    setQrStatus("loading"); setQrMobileUrl(null); setQrToken(null);
    if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
    try {
      const res  = await fetch("/api/auth/mobile-challenge", { method: "POST" });
      const data = await res.json() as { token?: string; qrDataUrl?: string; error?: string };
      if (!data.token || !data.qrDataUrl) {
        setQrStatus("error");
        return;
      }
      setQrToken(data.token);
      setQrMobileUrl(data.qrDataUrl);
      setQrStatus("polling");

      /* Poll every 2.5 s for up to 5 min */
      const token = data.token;
      qrPollRef.current = setInterval(async () => {
        try {
          const pr   = await fetch(`/api/auth/mobile-challenge?token=${token}&action=status`);
          const pd   = await pr.json() as { status: "pending" | "verified" | "expired" };
          if (pd.status === "verified") {
            clearInterval(qrPollRef.current!);
            qrPollRef.current = null;
            setQrStatus("verified");
            await update({ twoFactorVerified: true });
            onClose();
          } else if (pd.status === "expired") {
            clearInterval(qrPollRef.current!);
            qrPollRef.current = null;
            setQrStatus("expired");
          }
        } catch { /* network hiccup — keep polling */ }
      }, 2500);

      /* Stop polling after 5 min regardless */
      setTimeout(() => {
        if (qrPollRef.current) {
          clearInterval(qrPollRef.current);
          qrPollRef.current = null;
          setQrStatus(s => s === "polling" ? "expired" : s);
        }
      }, 5 * 60_000);

    } catch {
      setQrStatus("error");
    }
  }

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
      <style>{`
        @keyframes auth-rise      { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes auth-check-draw { to { stroke-dashoffset: 0; } }
        @keyframes auth-accent-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1;    }
        }
        @keyframes auth-glow-drift {
          0%, 100% { transform: translate(-50%, -54%) scale(1);    opacity: 0.55; }
          50%      { transform: translate(-50%, -54%) scale(1.06); opacity: 0.85; }
        }
        .auth-ms-btn { position: relative; overflow: hidden; }
        .auth-ms-btn::after {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.05) 38%, rgba(255,255,255,0.08) 44%, transparent 60%);
          transform: translateX(-120%);
          transition: transform 0.65s cubic-bezier(0.4,0,0.2,1);
        }
        .auth-ms-btn:hover::after { transform: translateX(20%); }
      `}</style>

      {/* ── Backdrop ───────────────────────────────────── */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 199,
          background: [
            "radial-gradient(ellipse 60% 46% at 50% 30%, rgba(0,204,122,0.05) 0%, transparent 68%)",
            "rgba(2,5,8,0.86)",
          ].join(","),
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
            backgroundImage: "linear-gradient(165deg, rgba(255,255,255,0.028) 0%, transparent 42%)",
            border: "1px solid var(--line-hi)",
            borderRadius: 12,
            padding: "30px 26px 24px",
            boxShadow: [
              "0 0 0 1px rgba(0,204,122,0.05)",
              "var(--shadow-lg)",
              "0 0 70px rgba(0,204,122,0.05)",
            ].join(","),
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "none",
            transform: open ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
            opacity: open ? 1 : 0,
            transition: "transform 0.32s cubic-bezier(0.16,1,0.3,1), opacity 0.24s ease",
            position: "relative",
          }}
        >
          {/* Top accent line — quiet institutional trust mark, not a light show */}
          <div style={{
            position: "absolute", top: 0, left: 14, right: 14, height: 1,
            background: "linear-gradient(90deg, transparent, var(--green), transparent)",
            animation: "auth-accent-pulse 3.2s ease-in-out infinite",
          }} />

          {/* ── Close ────────────────────────────────────── */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute", top: 14, right: 14,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--ink-3)", padding: 4, lineHeight: 0,
              borderRadius: 4, transition: "color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--ink-1)"; e.currentTarget.style.background = "var(--sub)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-3)"; e.currentTarget.style.background = "none"; }}
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
            <div style={{ animation: "auth-rise 0.4s 0.04s cubic-bezier(0.16,1,0.3,1) both" }}>
              <p className="section-eyebrow" style={{ color: "var(--green)", marginBottom: 8 }}>
                Institutional Access
              </p>
              <p style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink-0)", marginBottom: 5 }}>
                Sign in
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 24 }}>
                Restricted to authorised work accounts.
              </p>

              {/* Microsoft button */}
              <button
                className="auth-ms-btn"
                onClick={handleMicrosoft}
                disabled={msLoading}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "14px 16px",
                  background: "var(--sub)",
                  backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, transparent 50%)",
                  border: "1px solid var(--line-hi)",
                  borderRadius: 8, cursor: msLoading ? "not-allowed" : "pointer",
                  transition: "border-color 0.18s, background 0.18s, box-shadow 0.18s, transform 0.12s",
                  opacity: msLoading ? 0.6 : 1,
                  textAlign: "left",
                }}
                onMouseEnter={e => {
                  if (!msLoading) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line-act)";
                    (e.currentTarget as HTMLButtonElement).style.background  = "var(--raised)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow   = "0 4px 18px rgba(0,0,0,0.28)";
                    (e.currentTarget as HTMLButtonElement).style.transform  = "translateY(-1px)";
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line-hi)";
                  (e.currentTarget as HTMLButtonElement).style.background  = "var(--sub)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow   = "none";
                  (e.currentTarget as HTMLButtonElement).style.transform  = "translateY(0)";
                }}
              >
                <span style={{
                  lineHeight: 0, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: 6,
                  background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)",
                }}>
                  {msLoading ? <Spinner size={17} /> : <MsLogo />}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink-0)", lineHeight: 1.3 }}>
                    Continue with Microsoft
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--ink-3)", marginTop: 2, letterSpacing: "0.01em" }}>
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
                    padding: "11px 13px",
                    background: "var(--red-10)",
                    border: "1px solid rgba(240,58,87,0.25)",
                    borderRadius: 7,
                    display: "flex", alignItems: "flex-start", gap: 9,
                    animation: "auth-rise 0.22s cubic-bezier(0.16,1,0.3,1) both",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M8 5v4M8 11h.01" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="8" cy="8" r="7" stroke="var(--red)" strokeWidth="1.2"/>
                  </svg>
                  <p style={{ fontSize: 11.5, color: "var(--red)", lineHeight: 1.55, margin: 0 }}>{msError}</p>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24, justifyContent: "center" }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden style={{ color: "var(--ink-4, var(--ink-3))", flexShrink: 0 }}>
                  <rect x="3.5" y="7" width="9" height="6.5" rx="1.3" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <p style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.6, margin: 0, letterSpacing: "0.01em" }}>
                  Authorised personnel only · XTNL Solutions
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              STEP 2 — 2FA (biometric or TOTP code)
          ══════════════════════════════════════════════ */}
          {step === "totp" && (
            <>
              {/* ── QR mobile-challenge view ── */}
              {showQr && (
                <div style={{ animation: "auth-rise 0.32s cubic-bezier(0.16,1,0.3,1) both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
                        setShowQr(false); setQrStatus("idle"); setQrMobileUrl(null); setQrToken(null);
                      }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        background: "var(--sub)", border: "1px solid var(--line)",
                        cursor: "pointer", color: "var(--ink-2)", transition: "border-color 0.15s, color 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--line-act)"; e.currentTarget.style.color = "var(--ink-0)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--ink-2)"; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <div>
                      <p className="section-eyebrow" style={{ color: "var(--green)", marginBottom: 2 }}>Mobile Handoff</p>
                      <p style={{ fontSize: 17, fontWeight: 700, color: "var(--ink-0)", margin: 0, letterSpacing: "-0.01em" }}>
                        Scan to sign in
                      </p>
                    </div>
                  </div>

                  {(qrStatus === "loading") && (
                    <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                      <Spinner size={22} />
                    </div>
                  )}

                  {(qrStatus === "polling" || qrStatus === "verified") && qrMobileUrl && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                      {/* QR code */}
                      <div style={{
                        borderRadius: 12, padding: 12,
                        background: "#04080f", border: "1px solid rgba(0,204,122,0.25)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 0 24px rgba(0,204,122,0.12), 0 8px 24px rgba(0,0,0,0.35)",
                      }}>
                        <img
                          src={qrMobileUrl}
                          width={200} height={200}
                          alt="Scan with your phone to sign in"
                          style={{ display: "block", imageRendering: "pixelated", borderRadius: 4 }}
                        />
                      </div>

                      {qrStatus === "polling" && (
                        <>
                          <p style={{ fontSize: 12, color: "var(--ink-2)", textAlign: "center", lineHeight: 1.6, margin: 0 }}>
                            Open your phone&apos;s camera and scan this code.<br/>
                            Tap <strong style={{ color: "var(--ink-1)" }}>Verify with biometric</strong> when prompted.
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 20, background: "var(--sub)", border: "1px solid var(--line)" }}>
                            <Spinner size={12} />
                            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Waiting for approval…</span>
                          </div>
                        </>
                      )}

                      {qrStatus === "verified" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <CheckGlyph />
                          <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>Verified — signing in…</span>
                        </div>
                      )}
                    </div>
                  )}

                  {qrStatus === "expired" && (
                    <div style={{ textAlign: "center", padding: "16px 0" }}>
                      <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14 }}>QR code expired.</p>
                      <button type="button" onClick={handleQrSignIn} className="btn btn-ghost" style={{ fontSize: 12, padding: "9px 18px" }}>
                        Generate new QR
                      </button>
                    </div>
                  )}

                  {qrStatus === "error" && (
                    <p style={{ fontSize: 12, color: "var(--red)", textAlign: "center", padding: "12px 0" }}>
                      Could not create QR code. Make sure you have a passkey enrolled first.
                    </p>
                  )}

                  <p style={{ marginTop: 18, fontSize: 11, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.6 }}>
                    Valid for 5 minutes · scan once
                  </p>
                </div>
              )}

              {/* ── Add biometric panel ── */}
              {showAddBiometric && !showQr && (
                <div style={{ animation: "auth-rise 0.32s cubic-bezier(0.16,1,0.3,1) both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <button
                      type="button"
                      onClick={() => { setShowAddBiometric(false); setPasskeyError(null); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        background: "var(--sub)", border: "1px solid var(--line)",
                        cursor: "pointer", color: "var(--ink-2)", transition: "border-color 0.15s, color 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--line-act)"; e.currentTarget.style.color = "var(--ink-0)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--ink-2)"; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <div>
                      <p className="section-eyebrow" style={{ color: "var(--green)", marginBottom: 2 }}>Enrollment</p>
                      <p style={{ fontSize: 17, fontWeight: 700, color: "var(--ink-0)", margin: 0, letterSpacing: "-0.01em" }}>Add biometric device</p>
                    </div>
                  </div>

                  {/* ── Phone / Microsoft Authenticator ── */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", color: "var(--green)", margin: 0 }}>
                      RECOMMENDED
                    </p>

                    <div style={{
                      border: "1px solid rgba(0,204,122,0.25)", borderRadius: 10,
                      padding: "15px 16px", background: "rgba(0,204,122,0.045)",
                      backgroundImage: "linear-gradient(160deg, rgba(0,204,122,0.05) 0%, transparent 55%)",
                      display: "flex", flexDirection: "column", gap: 12,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <span style={{ lineHeight: 0, flexShrink: 0, color: "var(--green)", marginTop: 2 }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <rect x="5" y="2" width="14" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                            <circle cx="12" cy="17" r="1.2" fill="currentColor"/>
                            <path d="M9 10a3 3 0 1 1 6 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            <rect x="8" y="11" width="8" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                          </svg>
                        </span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)", margin: "0 0 4px" }}>
                            Microsoft Authenticator (phone)
                          </p>
                          <p style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>
                            Register your phone&apos;s fingerprint or Face ID via Microsoft Authenticator.
                            Works for the QR sign-in flow.
                          </p>
                        </div>
                      </div>

                      {/* Step-by-step guide */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 7, borderTop: "1px solid rgba(0,204,122,0.12)", paddingTop: 12 }}>
                        {[
                          { n: 1, text: "Click Register below — your browser opens a security dialog." },
                          { n: 2, text: 'In the dialog, choose "Use a phone or tablet" or "Use another device".' },
                          { n: 3, text: "A QR code appears in your browser. Open Microsoft Authenticator on your phone and scan it." },
                          { n: 4, text: "Authenticator prompts you for Face ID or fingerprint. Approve it." },
                          { n: 5, text: "Done — your phone is now registered as a biometric key." },
                        ].map(({ n, text }) => (
                          <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <span style={{
                              flexShrink: 0, width: 18, height: 18,
                              borderRadius: "50%", background: "rgba(0,204,122,0.15)",
                              border: "1px solid rgba(0,204,122,0.3)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 700, color: "var(--green)",
                            }}>{n}</span>
                            <p style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>{text}</p>
                          </div>
                        ))}
                      </div>

                      {/* ── Register QR panel ── */}
                      {regQrStatus === "idle" && (
                        <button
                          type="button"
                          onClick={handlePhoneRegisterQr}
                          className="btn btn-primary"
                          style={{ width: "100%", padding: "11px", fontSize: 13 }}
                        >
                          Register with Microsoft Authenticator
                        </button>
                      )}

                      {regQrStatus === "loading" && (
                        <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                          <Spinner size={22} />
                        </div>
                      )}

                      {(regQrStatus === "polling" || regQrStatus === "verified") && regQrUrl && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, animation: "auth-rise 0.28s cubic-bezier(0.16,1,0.3,1) both" }}>
                          <div style={{
                            borderRadius: 11, padding: 11,
                            background: "#04080f", border: "1px solid rgba(0,204,122,0.25)",
                            boxShadow: "0 0 22px rgba(0,204,122,0.12), 0 8px 22px rgba(0,0,0,0.32)",
                          }}>
                            <img src={regQrUrl} width={180} height={180} alt="Scan to register biometric" style={{ display: "block", imageRendering: "pixelated", borderRadius: 4 }} />
                          </div>
                          {regQrStatus === "polling" && (
                            <>
                              <p style={{ fontSize: 12, color: "var(--ink-2)", textAlign: "center", lineHeight: 1.6, margin: 0 }}>
                                Scan with your phone camera.<br/>
                                Tap <strong style={{ color: "var(--ink-1)" }}>Register with biometric</strong> on the page that opens.
                              </p>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Spinner size={12} /><span style={{ fontSize: 11, color: "var(--ink-3)" }}>Waiting for phone…</span>
                              </div>
                            </>
                          )}
                          {regQrStatus === "verified" && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <CheckGlyph />
                              <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>Phone registered successfully!</span>
                            </div>
                          )}
                        </div>
                      )}

                      {regQrStatus === "expired" && (
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 10 }}>QR expired.</p>
                          <button type="button" onClick={handlePhoneRegisterQr} className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 16px" }}>
                            Generate new QR
                          </button>
                        </div>
                      )}

                      {regQrStatus === "error" && (
                        <p style={{ fontSize: 12, color: "var(--red)", textAlign: "center" }}>
                          Could not create registration QR. Please try again.
                        </p>
                      )}
                    </div>
                  </div>

                  {passkeyError && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <p style={{ fontSize: 11.5, color: "var(--red)", lineHeight: 1.55, margin: 0 }}>{passkeyError}</p>
                      <button
                        type="button"
                        onClick={() => { setPasskeyError(null); handleBiometricSetup("cross-platform"); }}
                        className="btn btn-ghost"
                        style={{ fontSize: 12, padding: "9px 14px", width: "100%" }}
                      >
                        Try Microsoft Authenticator on phone instead
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Normal 2FA view ── */}
              {!showQr && !showAddBiometric && (
                <div style={{ animation: "auth-rise 0.32s cubic-bezier(0.16,1,0.3,1) both" }}>
              <p className="section-eyebrow" style={{ color: "var(--green)", marginBottom: 8 }}>
                Two-Factor Verification
              </p>
              <p style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink-0)", marginBottom: 5 }}>
                Verify your identity
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 20 }}>
                {passkeyStatus === "enrolled" && !showCodeEntry
                  ? "Approve the sign-in biometrically from Microsoft Authenticator."
                  : enrolled === false
                  ? "Set up Microsoft Authenticator to complete sign-in."
                  : "Enter your Microsoft Authenticator code to continue."}
              </p>

              {/* ── Loading ────────────────────────────── */}
              {totpLoading && (
                <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                  <Spinner size={22} />
                </div>
              )}

              {!totpLoading && (
                <>
                  {/* ══ A: passkey enrolled — show biometric button ══ */}
                  {passkeyStatus === "enrolled" && !showCodeEntry && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <button
                        type="button"
                        onClick={handleBiometricAuth}
                        disabled={passkeyLoading}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          width: "100%", padding: "14px 16px",
                          background: "rgba(0,204,122,0.08)",
                          backgroundImage: "linear-gradient(160deg, rgba(0,204,122,0.06) 0%, transparent 55%)",
                          border: "1px solid rgba(0,204,122,0.30)",
                          borderRadius: 8, cursor: passkeyLoading ? "not-allowed" : "pointer",
                          transition: "border-color 0.18s, background 0.18s, box-shadow 0.18s, transform 0.12s", textAlign: "left",
                        }}
                        onMouseEnter={e => { if (!passkeyLoading) { e.currentTarget.style.background = "rgba(0,204,122,0.14)"; e.currentTarget.style.borderColor = "rgba(0,204,122,0.55)"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,204,122,0.1)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,204,122,0.08)"; e.currentTarget.style.borderColor = "rgba(0,204,122,0.30)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
                      >
                        <span style={{
                          lineHeight: 0, flexShrink: 0, color: "var(--green)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 34, height: 34, borderRadius: 6,
                          background: "rgba(0,204,122,0.1)", border: "1px solid rgba(0,204,122,0.22)",
                        }}>
                          {passkeyLoading ? <Spinner size={17} /> : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <rect x="5" y="2" width="14" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                              <circle cx="12" cy="17" r="1.2" fill="currentColor"/>
                              <path d="M9 10a3 3 0 1 1 6 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              <rect x="8" y="11" width="8" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                            </svg>
                          )}
                        </span>
                        <span style={{ flex: 1 }}>
                          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--green)", lineHeight: 1.3 }}>
                            {passkeyLoading ? "Waiting for biometric…" : "Use Biometric Sign-in"}
                          </span>
                          <span style={{ display: "block", fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                            Microsoft Authenticator · Face ID / Fingerprint
                          </span>
                        </span>
                      </button>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, height: 1, background: "var(--line)" }}/>
                        <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.1em" }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: "var(--line)" }}/>
                      </div>

                      <button
                        type="button"
                        onClick={() => { setShowCodeEntry(true); setPasskeyError(null); }}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 12, color: "var(--ink-2)", textAlign: "center",
                          padding: "4px 0", textDecoration: "underline",
                          textDecorationColor: "var(--line-hi)", transition: "color 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--ink-0)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-2)"; }}
                      >
                        Use authenticator code instead
                      </button>

                      {/* QR code option for passkey-enrolled users */}
                      <button
                        type="button"
                        onClick={() => { setShowQr(true); handleQrSignIn(); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 11.5, color: "var(--ink-3)", padding: "2px 0",
                          textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.1)",
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--ink-1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-3)"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                          <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                          <rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                          <rect x="2.5" y="2.5" width="2" height="2" fill="currentColor"/>
                          <rect x="11.5" y="2.5" width="2" height="2" fill="currentColor"/>
                          <rect x="2.5" y="11.5" width="2" height="2" fill="currentColor"/>
                          <path d="M10 10h2v2h-2zM12 12h2v2h-2zM10 14h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                        </svg>
                        Sign in via QR code
                      </button>

                      {/* Add biometric device */}
                      <button
                        type="button"
                        onClick={() => { setShowAddBiometric(true); setPasskeyError(null); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 11.5, color: "var(--ink-3)", padding: "2px 0",
                          textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.1)",
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--ink-1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-3)"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        Add another biometric device
                      </button>
                      {passkeyError && (
                        <p style={{ fontSize: 11.5, color: "var(--red)", lineHeight: 1.5, margin: 0 }}>{passkeyError}</p>
                      )}
                    </div>
                  )}

                  {/* ══ B: code entry — primary for TOTP-only, fallback for passkey users ══ */}
                  {(passkeyStatus !== "enrolled" || showCodeEntry) && (
                    <>
                      {/* Back link when falling back from biometric */}
                      {passkeyStatus === "enrolled" && showCodeEntry && (
                        <button
                          type="button"
                          onClick={() => { setShowCodeEntry(false); setPasskeyError(null); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 11.5, color: "var(--ink-2)", padding: "0 0 14px 0",
                            transition: "color 0.15s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = "var(--ink-0)"; }}
                          onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-2)"; }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                            <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Back to biometric
                        </button>
                      )}

                      <form onSubmit={handleVerify} noValidate>
                        {/* ── First-time TOTP setup ── */}
                        {enrolled === false && (
                          <>
                            <Tabs active={tab} onChange={t => { setTab(t); setOtp(""); setOtpError(false); }} />

                            {tab === "qr" && (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                                <p style={{ fontSize: 12, color: "var(--ink-2)", textAlign: "center", lineHeight: 1.6 }}>
                                  Open Microsoft Authenticator → Add account → Scan QR code.
                                </p>
                                <div style={{
                                  background: "#fff", borderRadius: 10, padding: 11,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  width: 148, height: 148, flexShrink: 0,
                                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                                }}>
                                  {qrUrl ? (
                                    <img src={qrUrl} width={128} height={128} alt="Scan with Microsoft Authenticator" style={{ display: "block", imageRendering: "pixelated" }} />
                                  ) : (
                                    <span style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>QR unavailable</span>
                                  )}
                                </div>
                                <p style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.55 }}>
                                  After scanning, switch to{" "}
                                  <button type="button" onClick={() => setTab("code")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--green)", fontWeight: 600, fontSize: 11, padding: 0 }}>
                                    Enter code
                                  </button>
                                  {" "}to complete setup.
                                </p>
                              </div>
                            )}

                            {tab === "code" && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "auth-rise 0.24s cubic-bezier(0.16,1,0.3,1) both" }}>
                                <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 }}>
                                  Enter the 6-digit code from Microsoft Authenticator to finish setup.
                                </p>
                                <OtpInput value={otp} onChange={v => { setOtp(v); setOtpError(false); }} error={otpError} disabled={otpLoading} />
                                {otpError && <p style={{ fontSize: 11.5, color: "var(--red)", marginTop: -4 }}>Incorrect code. Try again.</p>}
                                <button type="submit" className="btn btn-primary" disabled={otpLoading || otp.replace(/\D/g, "").length < 6} style={{ width: "100%", padding: "13px", fontSize: 13, marginTop: 4 }}>
                                  {otpLoading ? <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}><Spinner /> Verifying…</span> : "Complete setup"}
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        {/* ── Returning user TOTP ── */}
                        {enrolled === true && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 }}>
                              Enter the 6-digit code shown in Microsoft Authenticator.
                            </p>
                            <OtpInput value={otp} onChange={v => { setOtp(v); setOtpError(false); }} error={otpError} disabled={otpLoading} />
                            {otpError && <p style={{ fontSize: 11.5, color: "var(--red)", marginTop: -4 }}>Incorrect code. Try again.</p>}
                            <button type="submit" className="btn btn-primary" disabled={otpLoading || otp.replace(/\D/g, "").length < 6} style={{ width: "100%", padding: "13px", fontSize: 13, marginTop: 4 }}>
                              {otpLoading ? <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}><Spinner /> Verifying…</span> : "Authenticate"}
                            </button>
                          </div>
                        )}
                      </form>

                      {/* ── Offer biometric setup for users without a passkey ── */}
                      {passkeyStatus === "none" && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px" }}>
                            <div style={{ flex: 1, height: 1, background: "var(--line)" }}/>
                            <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.1em" }}>
                              {enrolled ? "FASTER SIGN-IN" : "OR"}
                            </span>
                            <div style={{ flex: 1, height: 1, background: "var(--line)" }}/>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAddBiometric(true)}
                            disabled={passkeyLoading}
                            style={{
                              display: "flex", alignItems: "center", gap: 11,
                              width: "100%", padding: "11px 14px",
                              background: "var(--sub)", border: "1px solid var(--line)",
                              borderRadius: 8, cursor: passkeyLoading ? "not-allowed" : "pointer",
                              transition: "border-color 0.15s, background 0.15s", textAlign: "left",
                            }}
                            onMouseEnter={e => { if (!passkeyLoading) { e.currentTarget.style.borderColor = "rgba(0,204,122,0.35)"; e.currentTarget.style.background = "var(--raised)"; } }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.background = "var(--sub)"; }}
                          >
                            <span style={{
                              lineHeight: 0, flexShrink: 0, color: "var(--ink-2)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              width: 28, height: 28, borderRadius: 6,
                              background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)",
                            }}>
                              {passkeyLoading ? <Spinner size={14} /> : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <rect x="5" y="2" width="14" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                                  <path d="M9 10a3 3 0 1 1 6 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  <rect x="8" y="11" width="8" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                                </svg>
                              )}
                            </span>
                            <span style={{ flex: 1 }}>
                              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-1)", lineHeight: 1.3 }}>
                                {passkeyLoading ? "Setting up…" : enrolled ? "Set up biometric sign-in" : "Use biometric instead"}
                              </span>
                              <span style={{ display: "block", fontSize: 10.5, color: "var(--ink-3)", marginTop: 1 }}>
                                {enrolled ? "Skip codes on future sign-ins" : "No codes needed"} · Microsoft Authenticator
                              </span>
                            </span>
                            {!passkeyLoading && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden style={{ color: "var(--ink-3)", flexShrink: 0 }}>
                                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                          {passkeyError && (
                            <p style={{ fontSize: 11.5, color: "var(--red)", lineHeight: 1.5, marginTop: 8 }}>{passkeyError}</p>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Footer */}
                  <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 9, alignItems: "center" }}>
                    {/* QR option for TOTP-only users (passkeyStatus === "none") */}
                    {passkeyStatus === "none" && enrolled === true && (
                      <button
                        type="button"
                        onClick={() => { setShowQr(true); handleQrSignIn(); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 11.5, color: "var(--ink-3)", padding: "2px 0",
                          textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.1)",
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--ink-1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-3)"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                          <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                          <rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                          <rect x="2.5" y="2.5" width="2" height="2" fill="currentColor"/>
                          <rect x="11.5" y="2.5" width="2" height="2" fill="currentColor"/>
                          <rect x="2.5" y="11.5" width="2" height="2" fill="currentColor"/>
                          <path d="M10 10h2v2h-2zM12 12h2v2h-2zM10 14h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                        </svg>
                        Sign in via QR + fingerprint
                      </button>
                    )}
                    <div style={{ width: "100%", height: 1, background: "var(--line)" }} />
                    <p style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.6, margin: 0 }}>
                      Need help?{" "}
                      <a href="mailto:xt@xtnl-solutions.com" style={{ color: "var(--ink-2)", textDecoration: "underline", textDecorationColor: "var(--line-hi)" }}>
                        Contact administrator
                      </a>
                    </p>
                  </div>
                </>
              )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
