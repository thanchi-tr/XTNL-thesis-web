import { auth }          from "@/auth";
import { redirect }       from "next/navigation";
import type { Metadata }  from "next";
import SessionClient      from "./SessionClient";

export const metadata: Metadata = { title: "Session" };

export default async function SessionPage() {
  const session = await auth();
  if (!session?.twoFactorVerified || session.error === "RefreshAccessTokenError") redirect("/");
  return (
    <SessionClient
      user={{ email: session.userEmail, name: session.userName }}
    />
  );
}
