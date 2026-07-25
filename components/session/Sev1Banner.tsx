"use client";

import { useEffect, useState } from "react";

const POLL_MS = 60_000;

/**
 * Shared SEV1 banner — used on both the session page (via
 * OpsGovernanceGuard) and the analytics page, so a strategist reviewing
 * analytics sees the same "a severe issue needs addressing this week"
 * signal an operator would see live. Self-contained (own poll) rather than
 * threaded through props/context — the underlying /ops-flags query is a
 * single cheap indexed read, so a second independent poller here costs
 * nothing worth avoiding.
 *
 * Clears automatically once the SEV1 issue either gets archived or has an
 * active solution tagged for the current week — see ops-flags/route.ts.
 */
export default function Sev1Banner() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch("/api/session/issues/ops-flags");
        if (r.ok && !cancelled) {
          const j = await r.json() as { sev1Active?: boolean };
          setActive(!!j.sev1Active);
        }
      } catch { /* keep last known state */ }
    };
    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!active) return null;

  return (
    <div
      role="alert"
      className="mono"
      style={{
        // Fixed, pinned right below NavBar (fixed, top:0, zIndex:100) and
        // StatusBar (fixed, top:var(--nav-h), zIndex:90) — NOT sticky/top:0,
        // which sticks to the *viewport* top once scrolled and lands
        // directly on top of both, producing overlapping/bleeding text.
        position:      "fixed",
        top:           "calc(var(--nav-h) + var(--bar-h))",
        left:          0,
        right:         0,
        zIndex:        95,
        padding:       "7px 16px",
        background:    "rgba(240,58,87,0.14)",
        borderBottom:  "1px solid rgba(240,58,87,0.4)",
        color:         "#f03a57",
        fontSize:      11,
        fontWeight:    700,
        textAlign:     "center",
        letterSpacing: "0.04em",
      }}
    >
      ⚠ SEV1 — a DIRE/CRITICAL issue needs a solution assigned for this week or to be fully resolved.
    </div>
  );
}
