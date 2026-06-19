import type { AppProps } from "next/app";
import { SessionProvider } from "@/shared/lib/SessionProvider";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
