import { auth }         from "@/auth";
import { redirect }      from "next/navigation";
import type { Metadata } from "next";
import AnalyticsClient   from "./AnalyticsClient";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.twoFactorVerified) redirect("/");

  const roles   = session.roles ?? [];
  const canView = roles.some(r => ["strategist", "fund_manager"].includes(r));
  if (!canView) redirect("/");

  return <AnalyticsClient user={{ email: session.userEmail, name: session.userName }} />;
}
