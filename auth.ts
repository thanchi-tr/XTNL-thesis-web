import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { supabase } from "@/lib/supabase";

/* ── Extend next-auth types ──────────────────────────────── */
declare module "next-auth" {
  interface Session {
    twoFactorVerified: boolean;
    userEmail:         string;
    userName:          string;
    roles:             string[];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    twoFactorVerified?: boolean;
    userEmail?:         string;
    userName?:          string;
    roles?:             string[];
  }
}

async function fetchRolesByUserId(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("user_role")
    .select("role(name)")
    .eq("user_id", userId);
  if (!data) return [];
  return (data as any[])
    .map(r => Array.isArray(r.role) ? r.role[0]?.name : r.role?.name)
    .filter((n): n is string => typeof n === "string");
}

async function fetchRoles(email: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("users")
      .select("user_id")
      .eq("username", email)
      .single();
    if (!data?.user_id) return [];
    return fetchRolesByUserId(data.user_id);
  } catch {
    return [];
  }
}

/** Called on first OAuth sign-in.
 *  If the user already exists → return their roles.
 *  If new → insert into `users`, assign `analyst` role, return ["analyst"]. */
async function provisionAndFetchRoles(
  email: string,
  displayName: string,
): Promise<string[]> {
  try {
    /* ── Check for existing user ── */
    const { data: existing } = await supabase
      .from("users")
      .select("user_id")
      .eq("username", email)
      .single();

    if (existing?.user_id) return fetchRolesByUserId(existing.user_id);

    /* ── New user: split display name ── */
    const parts      = displayName.trim().split(/\s+/);
    const givenName  = parts[0]          ?? "";
    const familyName = parts.slice(1).join(" ") ?? "";

    const { data: newUser, error } = await supabase
      .from("users")
      .insert({ username: email, given_name: givenName, family_name: familyName })
      .select("user_id")
      .single();

    if (error || !newUser?.user_id) {
      console.error("[auth] Failed to provision user:", error);
      return [];
    }

    /* ── Assign analyst role ── */
    const { data: analystRole } = await supabase
      .from("role")
      .select("id")
      .eq("name", "analyst")
      .single();

    if (analystRole?.id) {
      await supabase.from("user_role").insert({
        user_id:     newUser.user_id,
        role_id:     analystRole.id,
        assigned_by: newUser.user_id,
      });
    }

    return ["analyst"];
  } catch (err) {
    console.error("[auth] provisionAndFetchRoles error:", err);
    return [];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  /* Disable debug logging — it's very noisy and the chunking warnings are
     resolved by not storing provider tokens in the JWT */
  providers: [
    MicrosoftEntraID({
      clientId:     process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      authorization: {
        params: { scope: "openid profile email" },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      /* ── Initial sign-in: provision user if new, fetch roles ── */
      if (account) {
        const email = user?.email    ?? "";
        const name  = user?.name     ?? "";
        const roles = await provisionAndFetchRoles(email, name);
        return {
          sub:               token.sub,
          twoFactorVerified: false,
          userEmail:         email,
          userName:          name,
          roles,
        };
      }

      /* ── Backfill roles for JWTs created before RBAC ── */
      if (token.roles === undefined && token.userEmail) {
        token.roles = await fetchRoles(token.userEmail);
      }

      /* ── 2FA elevation ── */
      if (trigger === "update" && session?.twoFactorVerified === true) {
        token.twoFactorVerified = true;
      }

      return token;
    },

    session({ session, token }) {
      session.twoFactorVerified = token.twoFactorVerified ?? false;
      session.userEmail         = token.userEmail         ?? "";
      session.userName          = token.userName          ?? "";
      session.roles             = token.roles             ?? [];
      return session;
    },
  },
  pages: {
    signIn: "/",
    error:  "/sign-error",
  },
});
