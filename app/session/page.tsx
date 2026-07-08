import { auth }             from "@/auth";
import { redirect }          from "next/navigation";
import type { Metadata }     from "next";
import SessionClient         from "./SessionClient";
import SessionCountdown      from "./SessionCountdown";

export const metadata: Metadata = { title: "Session" };

/* Returns the current mode in Melbourne time */
function getMelbourneMode(): "operator" | "analyst" {
  const melbStr = new Date().toLocaleString("en-US", { timeZone: "Australia/Melbourne" });
  const melb    = new Date(melbStr);
  const day = melb.getDay(), hour = melb.getHours();
  return (day === 0 || (day === 6 && hour >= 1)) ? "analyst" : "operator";
}

export default async function SessionPage() {
  const session = await auth();
  if (!session?.twoFactorVerified) redirect("/");

  const roles       = session.roles ?? [];
  const canAnalyst  = roles.some(r => ["analyst",  "fund_manager"].includes(r));
  const canOperator = roles.some(r => ["operator", "fund_manager"].includes(r));
  if (!canAnalyst && !canOperator) redirect("/");

  const currentMode = getMelbourneMode();
  const allowed =
    (currentMode === "operator" && canOperator) ||
    (currentMode === "analyst"  && canAnalyst);

  if (!allowed) {
    /* User has a valid role but it's the wrong time window */
    const waitFor: "analyst" | "operator" = canAnalyst ? "analyst" : "operator";
    return (
      <SessionCountdown
        waitFor={waitFor}
        user={{ email: session.userEmail, name: session.userName }}
      />
    );
  }

  return (
    <SessionClient
      user={{ email: session.userEmail, name: session.userName }}
      viewMode={currentMode}
    />
  );
}
