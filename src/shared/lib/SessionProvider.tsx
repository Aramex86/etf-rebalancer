// src/shared/lib/SessionProvider.tsx
// Client-side wrapper around next-auth/react SessionProvider.
// Must be a client component — used in the root layout to provide session context.

"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </NextAuthSessionProvider>
  );
}
