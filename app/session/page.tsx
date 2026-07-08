import { auth }          from "@/auth";
import { redirect }       from "next/navigation";
import type { Metadata }  from "next";
import SessionClient      from "./SessionClient";

export const metadata: Metadata = { title: "Session" };

export default async function SessionPage() {
  const session = await auth();
  if (!session?.twoFactorVerified) redirect("/");

  const roles       = session.roles ?? [];
  const canAnalyst  = roles.some(r => ["analyst",  "fund_manager"].includes(r));
  const canOperator = roles.some(r => ["operator", "fund_manager"].includes(r));
  if (!canAnalyst && !canOperator) redirect("/");

  const viewMode: "operator" | "analyst" = canAnalyst ? "analyst" : "operator";

  return (
    <SessionClient
      user={{ email: session.userEmail, name: session.userName }}
      viewMode={viewMode}
    />
  );
}
