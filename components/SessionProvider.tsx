"use client";

import { SessionProvider as NextAuthProvider } from "next-auth/react";

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  /* Disable polling & window-focus refetch so the Monte Carlo simulator
     (and other heavy client components) are not interrupted by session
     network requests after the initial login. The session only needs to
     exist — it doesn't change while the user is mid-session.              */
  return (
    <NextAuthProvider refetchOnWindowFocus={false} refetchInterval={0}>
      {children}
    </NextAuthProvider>
  );
}
