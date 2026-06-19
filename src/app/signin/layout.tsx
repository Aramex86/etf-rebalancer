import { SessionProvider } from "@/shared/lib/SessionProvider";

export default function SignInLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SessionProvider>{children}</SessionProvider>;
}

export const metadata = {
  title: "Sign in",
};

export const dynamic = "force-dynamic";
