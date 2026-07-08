import type { Metadata }     from "next";
import RateLimitedClient from "./RateLimitedClient";

export const metadata: Metadata = { title: "Rate Limited — XTNL" };

export default async function RateLimitedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params  = await searchParams;
  const resetAt = parseInt(params.reset ?? "0", 10) || Date.now() + 60_000;
  const tier    = (params.tier ?? "guest") as string;

  return <RateLimitedClient resetAt={resetAt} tier={tier} />;
}
