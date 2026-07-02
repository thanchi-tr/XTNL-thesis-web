import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/* ── Extend next-auth types ──────────────────────────────── */
declare module "next-auth" {
  interface Session {
    twoFactorVerified: boolean;
    userEmail:         string;
    userName:          string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    twoFactorVerified?: boolean;
    userEmail?:         string;
    userName?:          string;
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
    jwt({ token, user, account, trigger, session }) {
      /* ── Initial sign-in: only store what we actually need ── */
      if (account) {
        return {
          /* keep the standard sub/iat/exp from the provider id_token */
          sub:               token.sub,
          twoFactorVerified: false,
          userEmail:         user?.email ?? "",
          userName:          user?.name  ?? "",
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
      return session;
    },
  },
  pages: {
    signIn: "/",
    error:  "/sign-error",
  },
});
