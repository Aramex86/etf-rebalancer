export default function SignInLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}

export const metadata = {
  title: "Sign in",
};

export const dynamic = "force-dynamic";
