import { auth }          from "@/auth";
import { redirect }       from "next/navigation";
import type { Metadata }  from "next";
import SessionClient      from "./SessionClient";

export const metadata: Metadata = { title: "Session | XTNL" };

export default async function SessionPage() {
  const session = await auth();
  if (!session?.twoFactorVerified) redirect("/");
  return (
    <SessionClient
      user={{ email: session.userEmail, name: session.userName }}
    />
  );
}
