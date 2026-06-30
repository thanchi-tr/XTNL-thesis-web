import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/* ── Extend next-auth types ──────────────────────────────── */
declare module "next-auth" {
  interface Session {
    twoFactorVerified: boolean;
    userEmail: string;
    userName: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    twoFactorVerified?: boolean;
    userEmail?: string;
    userName?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  logger: {
    error(error) { console.error("[next-auth]", error); },
    warn(code)   { console.warn("[next-auth]", code);  },
  },
  providers: [
    /*
     * Tenant scoping: set AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=<your-tenant-id>
     * to lock sign-in to a single Azure AD org, or leave as "organizations"
     * to allow any Microsoft 365 work/school account (blocks personal MSA).
     * The provider reads AUTH_MICROSOFT_ENTRA_ID_* env vars automatically.
     */
    MicrosoftEntraID({
      clientId:     process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      /* Fresh sign-in: reset 2FA gate */
      if (user) {
        token.twoFactorVerified = false;
        token.userEmail = user.email ?? "";
        token.userName  = user.name  ?? "";
      }
      /* Client called update({ twoFactorVerified: true }) after TOTP verify */
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
    signIn:  "/",
    error:   "/sign-error",
  },
});
