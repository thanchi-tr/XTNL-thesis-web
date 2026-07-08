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

async function fetchRoles(email: string): Promise<string[]> {
  try {
    const { data: userRow } = await supabase
      .from("users")
      .select("user_id")
      .eq("username", email)
      .single();
    if (!userRow?.user_id) return [];

    const { data: roleRows } = await supabase
      .from("user_role")
      .select("role(name)")
      .eq("user_id", userRow.user_id);
    if (!roleRows) return [];

    return (roleRows as any[])
      .map(r => Array.isArray(r.role) ? r.role[0]?.name : r.role?.name)
      .filter((n): n is string => typeof n === "string");
  } catch {
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
      /* ── Initial sign-in: fetch roles from Supabase ── */
      if (account) {
        const email = user?.email ?? "";
        const roles = await fetchRoles(email);
        return {
          sub:               token.sub,
          twoFactorVerified: false,
          userEmail:         email,
          userName:          user?.name ?? "",
          roles,
        };
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
