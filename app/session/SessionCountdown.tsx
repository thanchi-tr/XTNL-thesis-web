"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  waitFor: "analyst" | "operator";
  user: { email: string; name: string };
};

/* Compute the UTC timestamp of the next window start, expressed in Melbourne time */
function getNextWindowStart(waitFor: "analyst" | "operator"): Date {
  const now     = new Date();
  const melbStr = now.toLocaleString("en-US", { timeZone: "Australia/Melbourne" });
  const melbNow = new Date(melbStr);
  /* melbNow has correct local-time values but wrong epoch —
     offset below bridges back to UTC */
  const offset  = melbNow.getTime() - now.getTime();

  const day  = melbNow.getDay();
  const hour = melbNow.getHours();
  const target = new Date(melbNow);

  if (waitFor === "analyst") {
    /* Analyst window: Saturday 01:00 AM Melbourne */
    if (day === 6 && hour < 1) {
      /* This Saturday, before 1am — starts today */
      target.setHours(1, 0, 0, 0);
    } else {
      /* Next Saturday */
      const daysToSat = ((6 - day) + 7) % 7 || 7;
      target.setDate(target.getDate() + daysToSat);
      target.setHours(1, 0, 0, 0);
    }
  } else {
    /* Operator window: Monday 00:00 AM Melbourne */
    const daysToMon = ((1 - day) + 7) % 7 || 7;
    target.setDate(target.getDate() + daysToMon);
    target.setHours(0, 0, 0, 0);
  }

  return new Date(target.getTime() - offset);
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}

export default function SessionCountdown({ waitFor, user }: Props) {
  const router = useRouter();
  const [target]    = useState(() => getNextWindowStart(waitFor));
  const [remaining, setRemaining] = useState(() => target.getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const rem = target.getTime() - Date.now();
      setRemaining(rem);
      if (rem <= 0) {
        clearInterval(id);
        router.refresh();
      }
    }, 1_000);
    return () => clearInterval(id);
  }, [target, router]);

  const { h, m, s } = formatCountdown(remaining);
  const isAnalyst  = waitFor === "analyst";
  const color      = isAnalyst ? "#4d9cf5" : "#00cc7a";
  const roleLabel  = isAnalyst ? "ANALYST" : "OPERATOR";
  const firstName  = user.name.split(" ")[0] || user.name;
  const isUrgent   = remaining < 3_600_000; /* < 1 hour */

  const targetStr = target.toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    weekday: "long", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const segments = [
    { val: h, label: "HRS" },
    { val: m, label: "MIN" },
    { val: s, label: "SEC" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      background: "var(--canvas)",
    }}>
      <div style={{
        maxWidth: 520,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
      }}>

        {/* Role badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 14px", borderRadius: 100,
          background: `${color}10`, border: `1px solid ${color}28`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase" as const, color,
          }}>
            {roleLabel} SESSION
          </span>
        </div>

        {/* Heading */}
        <div style={{ textAlign: "center" }}>
          <h1 style={{
            margin: "0 0 8px",
            fontSize: "clamp(22px, 3.5vw, 30px)",
            fontWeight: 700, letterSpacing: "-0.03em",
            color: "var(--ink-0)", lineHeight: 1.1,
          }}>
            Good timing, {firstName}
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.6 }}>
            Your {roleLabel.toLowerCase()} window opens{" "}
            <strong style={{ color: "var(--ink-1)" }}>{targetStr} AEST</strong>
          </p>
        </div>

        {/* Countdown digits */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" as const,
          justifyContent: "center",
        }}>
          {segments.map(({ val, label }, i) => (
            <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{
                background: "var(--card)",
                border: `1px solid ${isUrgent ? color + "40" : "var(--line-hi)"}`,
                borderRadius: 12,
                padding: "18px 22px",
                minWidth: 88,
                textAlign: "center",
                transition: "border-color 0.5s",
              }}>
                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "clamp(38px, 8vw, 52px)",
                  fontWeight: 800,
                  color: isUrgent ? color : "var(--ink-0)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  transition: "color 0.5s",
                }}>
                  {val}
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: "var(--ink-4)",
                  letterSpacing: "0.12em", textTransform: "uppercase" as const,
                  marginTop: 6,
                }}>
                  {label}
                </div>
              </div>
              {i < 2 && (
                <span style={{
                  fontSize: 40, fontWeight: 700,
                  color: "var(--ink-3)", fontFamily: "var(--font-mono)",
                  lineHeight: 1, marginTop: 14,
                  opacity: 0.5,
                }}>
                  :
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Schedule reference card */}
        <div style={{
          width: "100%",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 18px", borderBottom: "1px solid var(--line)",
            fontSize: 10, fontWeight: 700, color: "var(--ink-4)",
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
          }}>
            Session Schedule · Melbourne Time
          </div>
          <div style={{ padding: "0 18px 4px" }}>
            {[
              { days: "Mon – Sat 12:59 AM", mode: "OPERATOR", c: "#00cc7a", active: !isAnalyst },
              { days: "Sat 1:00 AM – Sun end", mode: "ANALYST",  c: "#4d9cf5", active: isAnalyst  },
            ].map(({ days, mode, c, active }) => (
              <div key={mode} style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 0",
                borderBottom: "1px solid var(--line)",
                opacity: active ? 1 : 0.45,
              }}>
                <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{days}</span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10.5,
                  fontWeight: 700, color: c,
                  padding: "2px 8px", borderRadius: 4,
                  background: `${c}10`, border: `1px solid ${c}28`,
                }}>
                  {mode}
                </span>
              </div>
            ))}
            <div style={{ padding: "10px 0", fontSize: 10.5, color: "var(--ink-4)", lineHeight: 1.5 }}>
              The page auto-refreshes when your window opens.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
