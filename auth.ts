import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { JWT } from "@auth/core/jwt";

/* ── Extend next-auth types ──────────────────────────────── */
declare module "next-auth" {
  interface Session {
    twoFactorVerified: boolean;
    userEmail:         string;
    userName:          string;
    accessToken?:      string;
    error?:            "RefreshAccessTokenError";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    twoFactorVerified?:   boolean;
    userEmail?:           string;
    userName?:            string;
    accessToken?:         string;
    refreshToken?:        string;
    accessTokenExpires?:  number; // epoch ms
    error?:               "RefreshAccessTokenError";
  }
}

/* ── Refresh the Microsoft access token using the refresh token ── */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? "organizations";
    const res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
          client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
          grant_type:    "refresh_token",
          refresh_token: token.refreshToken!,
          scope:         "openid profile email offline_access",
        }),
      },
    );

    const data = await res.json() as {
      access_token:   string;
      refresh_token?: string;
      expires_in:     number;
      error?:         string;
    };

    if (!res.ok || data.error) {
      console.error("[next-auth] refresh token error", data);
      throw data;
    }

    return {
      ...token,
      accessToken:       data.access_token,
      /* Microsoft may or may not rotate the refresh token — keep the old one as fallback */
      refreshToken:      data.refresh_token ?? token.refreshToken,
      accessTokenExpires: Date.now() + data.expires_in * 1_000,
      error:             undefined,
    };
  } catch (e) {
    console.error("[next-auth] refreshAccessToken failed", e);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  logger: {
    error(error) { console.error("[next-auth]", error); },
    warn(code)   { console.warn("[next-auth]", code);  },
  },
  providers: [
    MicrosoftEntraID({
      clientId:     process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      authorization: {
        params: {
          /* offline_access is required to receive a refresh_token */
          scope: "openid profile email offline_access",
        },
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, account, trigger, session }) {
      /* ── Initial sign-in: store provider tokens ── */
      if (account) {
        return {
          ...token,
          accessToken:       account.access_token,
          refreshToken:      account.refresh_token,
          /* expires_at from the provider is in seconds; convert to ms */
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1_000
            : Date.now() + 3_600_000,
          twoFactorVerified: false,
          userEmail: user?.email ?? "",
          userName:  user?.name  ?? "",
        };
      }

      /* ── 2FA elevation ── */
      if (trigger === "update" && session?.twoFactorVerified === true) {
        token.twoFactorVerified = true;
      }

      /* ── Access token still valid (60 s buffer) ── */
      if (Date.now() < (token.accessTokenExpires ?? 0) - 60_000) {
        return token;
      }

      /* ── Access token expired — attempt refresh ── */
      if (token.refreshToken) {
        return refreshAccessToken(token);
      }

      /* No refresh token available; return as-is (will surface as error) */
      return { ...token, error: "RefreshAccessTokenError" };
    },

    session({ session, token }) {
      session.twoFactorVerified = token.twoFactorVerified ?? false;
      session.userEmail         = token.userEmail         ?? "";
      session.userName          = token.userName          ?? "";
      session.accessToken       = token.accessToken;
      session.error             = token.error;
      return session;
    },
  },
  pages: {
    signIn:  "/",
    error:   "/sign-error",
  },
});
