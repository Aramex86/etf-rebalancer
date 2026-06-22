import type { AppProps } from "next/app";
import { SessionProvider } from "@/shared/lib/SessionProvider";

/**
 * Pages Router wrapper. The App Router pages use the SessionProvider
 * from src/app/layout.tsx — this one only covers Pages Router pages
 * (currently only /dashboard which is reachable via Next.js link).
 *
 * Both providers can coexist; each NextAuth SessionProvider manages
 * its own session context for its own router subtree.
 */
export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
