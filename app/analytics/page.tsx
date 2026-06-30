import { auth }         from "@/auth";
import { redirect }      from "next/navigation";
import type { Metadata } from "next";
import AnalyticsClient   from "./AnalyticsClient";

export const metadata: Metadata = { title: "Analytics | XTNL" };

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.twoFactorVerified) redirect("/");
  return <AnalyticsClient user={{ email: session.userEmail, name: session.userName }} />;
}
