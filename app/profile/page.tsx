import { auth }        from "@/auth";
import { redirect }    from "next/navigation";
import type { Metadata } from "next";
import ProfileClient  from "./ProfileClient";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.twoFactorVerified) redirect("/");
  return <ProfileClient user={{ email: session.userEmail ?? "", name: session.userName ?? "" }} />;
}
