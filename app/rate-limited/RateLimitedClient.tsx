"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const TIER_META: Record<string, { label: string; limit: number; color: string }> = {
  guest:        { label: "GUEST",        limit: 20,   color: "#ff4444" },
  operator:     { label: "OPERATOR",     limit: 100,  color: "#f0a030" },
  analyst:      { label: "ANALYST",      limit: 200,  color: "#f0a030" },
  strategist:   { label: "STRATEGIST",   limit: 500,  color: "#f0a030" },
  fund_manager: { label: "FUND MANAGER", limit: 2000, color: "#f0a030" },
};

function fmt(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1_000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h: String(h).padStart(2, "0"), m: String(m).padStart(2, "0"), s: String(s).padStart(2, "0") };
}

function Digit({ val, label }: { val: string; label: string }) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(val);

  useEffect(() => {
    if (val !== prev.current) {
      prev.current = val;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 120);
      return () => clearTimeout(t);
    }
  }, [val]);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        background: flash ? "rgba(255,68,68,0.08)" : "var(--card)",
        border: "1px solid rgba(255,68,68,0.18)",
        borderRadius: 10,
        padding: "16px 20px",
        minWidth: 76,
        transition: "background 0.1s",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(36px,8vw,52px)",
          fontWeight: 800,
          color: flash ? "#ff6666" : "var(--ink-0)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
          display: "block",
          transition: "color 0.1s",
        }}>
          {val}
        </span>
      </div>
      <span style={{
        display: "block", marginTop: 6,
        fontSize: 9, fontWeight: 700,
        color: "var(--ink-4)", letterSpacing: "0.12em",
        textTransform: "uppercase" as const,
      }}>
        {label}
      </span>
    </div>
  );
}

export default function RateLimitedClient({ resetAt, tier }: { resetAt: number; tier: string }) {
  const router  = useRouter();
  const meta    = TIER_META[tier] ?? TIER_META.guest;
  const [rem, setRem] = useState(() => resetAt - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const r = resetAt - Date.now();
      setRem(r);
      if (r <= 0) { clearInterval(id); router.replace(document.referrer || "/"); }
    }, 1_000);
    return () => clearInterval(id);
  }, [resetAt, router]);

  const { h, m, s } = fmt(rem);
  const isGuest = tier === "guest";

  return (
    <>
      <style>{`
        @keyframes scanDown {
          0%   { transform: translateY(-8px); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes glitch {
          0%,87%,100% { text-shadow: none; letter-spacing: 0.15em; }
          88% { text-shadow: 2px 0 rgba(255,68,68,0.9), -1px 0 rgba(77,156,245,0.6); letter-spacing: 0.16em; }
          89% { text-shadow: -2px 0 rgba(255,68,68,0.9); letter-spacing: 0.14em; }
          90% { text-shadow: 1px 0 rgba(77,156,245,0.7); letter-spacing: 0.15em; }
          91% { text-shadow: none; letter-spacing: 0.15em; }
        }
        @keyframes pulseRed {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,68,68,0.5), 0 0 0 0 rgba(255,68,68,0.2); }
          60%      { box-shadow: 0 0 0 10px rgba(255,68,68,0), 0 0 0 20px rgba(255,68,68,0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
        .rl-title    { animation: glitch 8s linear infinite; }
        .rl-icon-ring{ animation: pulseRed 2.2s ease-in-out infinite; }
        .rl-scan     { animation: scanDown 5s linear infinite; }
        .rl-in1 { animation: fadeUp 0.5s 0.1s ease both; }
        .rl-in2 { animation: fadeUp 0.5s 0.25s ease both; }
        .rl-in3 { animation: fadeUp 0.5s 0.4s ease both; }
        .rl-in4 { animation: fadeUp 0.5s 0.55s ease both; }
        .rl-cursor { animation: blink 1.1s step-end infinite; }
      `}</style>

      {/* Scanning line */}
      <div
        className="rl-scan"
        style={{
          position: "fixed", top: 0, left: 0, right: 0,
          height: 2,
          background: "linear-gradient(90deg, transparent, rgba(255,68,68,0.3) 40%, rgba(255,68,68,0.5) 50%, rgba(255,68,68,0.3) 60%, transparent)",
          pointerEvents: "none", zIndex: 10,
        }}
      />

      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,68,68,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,68,68,0.022) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      {/* Content */}
      <div style={{
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 20px",
        position: "relative", zIndex: 1,
      }}>
        <div style={{
          maxWidth: 480, width: "100%",
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 28,
        }}>

          {/* Pulsing icon */}
          <div className="rl-in1">
            <div
              className="rl-icon-ring"
              style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "rgba(255,68,68,0.08)",
                border: "1.5px solid rgba(255,68,68,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 9v4M12 17h.01" stroke="#ff4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#ff4444" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Title */}
          <div className="rl-in1" style={{ textAlign: "center" }}>
            <span
              className="rl-title mono"
              style={{
                display: "block",
                fontSize: "clamp(11px, 2vw, 13px)",
                fontWeight: 800,
                color: "#ff4444",
                letterSpacing: "0.15em",
                textTransform: "uppercase" as const,
                marginBottom: 10,
              }}
            >
              CONNECTION THROTTLED
            </span>
            <h1 style={{
              margin: 0,
              fontSize: "clamp(22px,4vw,30px)",
              fontWeight: 700,
              color: "var(--ink-0)",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}>
              Access temporarily suspended
            </h1>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.6 }}>
              {isGuest
                ? "Too many requests from this address. Sign in for a higher rate limit."
                : "Request rate exceeded. Your access will restore automatically."}
            </p>
          </div>

          {/* Countdown */}
          <div className="rl-in2" style={{ textAlign: "center", width: "100%" }}>
            <p style={{
              margin: "0 0 14px",
              fontSize: 11, fontWeight: 600,
              color: "var(--ink-4)", letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
            }}>
              Access restores in
            </p>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "center", flexWrap: "wrap" as const }}>
              {([
                { val: h, label: "hrs" },
                { val: m, label: "min" },
                { val: s, label: "sec" },
              ] as { val: string; label: string }[]).map(({ val, label }, i) => (
                <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Digit val={val} label={label} />
                  {i < 2 && (
                    <span style={{
                      fontSize: 40, fontWeight: 700,
                      color: "rgba(255,68,68,0.4)",
                      fontFamily: "var(--font-mono)",
                      lineHeight: 1, marginTop: 14,
                    }}>:</span>
                  )}
                </div>
              ))}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--ink-4)" }}>
              Page will redirect automatically when access is restored
              <span className="rl-cursor" style={{ marginLeft: 2 }}>_</span>
            </p>
          </div>

          {/* Info card */}
          <div className="rl-in3" style={{
            width: "100%",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 10, overflow: "hidden",
          }}>
            <div style={{
              padding: "11px 18px",
              borderBottom: "1px solid var(--line)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                padding: "2px 8px", borderRadius: 4,
                background: `${meta.color}12`,
                border: `1px solid ${meta.color}28`,
                fontSize: 10, fontWeight: 700,
                color: meta.color, fontFamily: "var(--font-mono)",
                letterSpacing: "0.08em", textTransform: "uppercase" as const,
              }}>
                {meta.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>access tier</span>
            </div>
            <div style={{ padding: "0 18px 4px" }}>
              {[
                ["Rate limit",  `${meta.limit} req / min`],
                ["Window",      "60 seconds sliding"],
                ["Status",      "Throttled — awaiting reset"],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "9px 0", borderBottom: "1px solid var(--line)",
                  fontSize: 12,
                }}>
                  <span style={{ color: "var(--ink-3)" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-1)", fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <div style={{ padding: "9px 0 5px", fontSize: 11, color: "var(--ink-4)", lineHeight: 1.6 }}>
                {isGuest
                  ? "Authenticated users receive 5–100× higher limits based on their assigned role."
                  : "Contact your administrator if you believe this limit is too restrictive."}
              </div>
            </div>
          </div>

          {/* XTNL footer mark */}
          <div className="rl-in4">
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.2em" }}>
              XTNL · SOVEREIGN TRUST · RATE CONTROL
            </span>
          </div>

        </div>
      </div>
    </>
  );
}
