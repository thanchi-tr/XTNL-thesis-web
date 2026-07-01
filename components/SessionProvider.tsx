"use client";

import { SessionProvider as NextAuthProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { signIn } from "next-auth/react";

/* Forces re-login if the server couldn't refresh the access token */
function TokenErrorGuard() {
  const { data: session } = useSession();
  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      signIn("microsoft-entra-id");
    }
  }, [session?.error]);
  return null;
}

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    /*
     * refetchOnWindowFocus — re-syncs the client session when the user
     *   returns to the tab (the server may have silently refreshed tokens).
     * refetchInterval — polls every 5 min so long-lived pages detect
     *   RefreshAccessTokenError before the next navigation. Kept low enough
     *   to catch expired refresh tokens (~24h lifetime on Entra ID) without
     *   hammering the auth endpoint. The Monte Carlo simulator is unaffected
     *   because it reads no session state during its computation.
     */
    <NextAuthProvider refetchOnWindowFocus refetchInterval={5 * 60}>
      <TokenErrorGuard />
      {children}
    </NextAuthProvider>
  );
}
