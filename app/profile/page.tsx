import { auth }        from "@/auth";
import { redirect }    from "next/navigation";
import type { Metadata } from "next";
import ProfileClient  from "./ProfileClient";
import { supabase }   from "@/lib/supabase";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.twoFactorVerified) redirect("/");

  const email = session.userEmail ?? "";

  /* Fetch live user record from Supabase — fresher than JWT cache */
  const { data: userRow } = await supabase
    .from("users")
    .select("user_id, given_name, family_name, created_at")
    .eq("username", email)
    .single();

  /* Derive display name: prefer Supabase given+family, fall back to OAuth name */
  const fullName = userRow
    ? `${userRow.given_name ?? ""} ${userRow.family_name ?? ""}`.trim() || (session.userName ?? "")
    : (session.userName ?? "");

  /* Member since — formatted in Australian locale */
  const memberSince = userRow?.created_at
    ? new Date(userRow.created_at).toLocaleDateString("en-AU", {
        year: "numeric", month: "long", day: "numeric",
      })
    : undefined;

  /* Fetch live roles directly — bypasses stale JWT */
  let roles: string[] = [];
  if (userRow?.user_id) {
    const { data: roleRows } = await supabase
      .from("user_role")
      .select("role(name)")
      .eq("user_id", userRow.user_id);
    if (roleRows) {
      roles = (roleRows as any[])
        .map(r => Array.isArray(r.role) ? r.role[0]?.name : r.role?.name)
        .filter((n): n is string => typeof n === "string");
    }
  }

  return (
    <ProfileClient
      user={{ email, name: fullName }}
      roles={roles}
      memberSince={memberSince}
    />
  );
}
