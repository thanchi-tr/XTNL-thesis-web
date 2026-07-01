"use client";

import { useSession } from "next-auth/react";
import XtnlLogo from "@/components/ui/XtnlLogo";
import { useEffect, useRef, useState } from "react";

const FOUNDER_META: Record<string, { name: string; title: string }> = {
  "xt@xtnl-solutions.com": { name: "XT", title: "FOUNDER" },
  "nl@xtnl-solutions.com": { name: "NL", title: "CO-FOUNDER" },
};
const FOUNDER_EMAILS = Object.keys(FOUNDER_META);

const EXP  = "cubic-bezier(0.16, 1, 0.3, 1)";
const WIPE = "cubic-bezier(0.7, 0, 0.08, 1)";

/* timing — total ≈ 3 s
   0.05s  logo        (0.38s → ends 0.43s)
   0.48s  welcome     (0.26s → ends 0.74s)
   0.78s  name wipe   (0.42s → ends 1.20s)
   1.20s  name glow   (0.40s)
   1.30s  title row   (0.26s)
   2.35s  exit starts (0.50s → unmount 2.85s)
*/

const STYLES = `
  @keyframes fw-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes fw-up {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fw-wipe {
    from { clip-path: inset(0 100% 0 0); }
    to   { clip-path: inset(0 0%   0 0); }
  }
  @keyframes fw-glow {
    from { filter: drop-shadow(0 0  0px rgba(0,204,122,0)); }
    to   { filter: drop-shadow(0 0 28px rgba(0,204,122,0.18)) drop-shadow(0 0 60px rgba(0,185,255,0.08)); }
  }
  @keyframes fw-exit {
    from { opacity: 1; filter: blur(0px); }
    to   { opacity: 0; filter: blur(6px); }
  }
`;

function an(name: string, dur: string, ease: string, delay: string, fill = "both"): string {
  return `${name} ${dur} ${ease} ${delay} ${fill}`;
}

function FounderAnimation({ name, title, onDone }: {
  name: string; title: string; onDone: () => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 2000);
    const t2 = setTimeout(onDone,                 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <>
      <style>{STYLES}</style>

      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: exiting ? an("fw-exit", "0.50s", "ease-in", "0s", "forwards") : undefined,
      }}>
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", textAlign: "center",
        }}>

          {/* Logo */}
          <div style={{
            marginBottom: 40,
            animation: an("fw-fade", "0.38s", EXP, "0.05s"),
          }}>
            <XtnlLogo width="26" height="26" style={{ filter: "drop-shadow(0 0 7px rgba(0,204,122,0.5))" }} />
          </div>

          {/* WELCOME BACK */}
          <p style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10, letterSpacing: "0.52em",
            color: "rgba(255,255,255,0.2)",
            margin: "0 0 10px",
            animation: an("fw-up", "0.26s", EXP, "0.48s"),
          }}>
            WELCOME BACK
          </p>

          {/* Name */}
          <h1 style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "clamp(96px, 22vw, 176px)",
            fontWeight: 900,
            letterSpacing: "0.04em",
            lineHeight: 0.88,
            margin: "0 0 24px",
            background: "linear-gradient(148deg, #fff 0%, #b8f7de 30%, #00cc7a 64%, #00e8ff 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            animation: [
              an("fw-wipe", "0.42s", WIPE,       "0.78s"),
              an("fw-glow", "0.40s", "ease-out", "1.20s"),
            ].join(", "),
          }}>
            {name}
          </h1>

          {/* Title */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            animation: an("fw-up", "0.26s", EXP, "1.30s"),
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: "#00cc7a",
              boxShadow: "0 0 6px rgba(0,204,122,0.8)",
            }} />
            <span style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9, letterSpacing: "0.34em",
              color: "rgba(255,255,255,0.18)",
            }}>
              {title}
            </span>
          </div>

        </div>
      </div>
    </>
  );
}

/* ─── Public wrapper ──────────────────────────────────────── */
export default function FounderWelcome() {
  const { data: session } = useSession();
  const [state, setState] = useState<{ visible: boolean; email: string }>({
    visible: false, email: "",
  });
  const prevVerified        = useRef(false);
  /* true only once we've seen a non-null session that was NOT yet 2FA-verified —
     distinguishes a genuine login flow from a page-refresh with an existing session */
  const sawUnverifiedSession = useRef(false);

  useEffect(() => {
    const email    = session?.userEmail        ?? "";
    const verified = session?.twoFactorVerified ?? false;

    if (session && !verified) sawUnverifiedSession.current = true;

    if (verified && !prevVerified.current && sawUnverifiedSession.current && FOUNDER_EMAILS.includes(email)) {
      setState({ visible: true, email });
    }
    prevVerified.current = verified;
  }, [session, session?.twoFactorVerified, session?.userEmail]);

  if (!state.visible) return null;

  const meta = FOUNDER_META[state.email] ?? {
    name: state.email.split("@")[0].toUpperCase(), title: "MEMBER",
  };
  return (
    <FounderAnimation
      name={meta.name}
      title={meta.title}
      onDone={() => setState(s => ({ ...s, visible: false }))}
    />
  );
}
