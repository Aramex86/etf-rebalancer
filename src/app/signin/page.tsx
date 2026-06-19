// src/app/signin/page.tsx
// Custom sign-in page — redirects authenticated users to the dashboard.

import { redirect } from "next/navigation";
import { auth } from "@/shared/lib/auth";
import SignInPage from "@/features/auth/ui/SignInPage";

export default async function SignInRoute() {
  const session = await auth();

  if (session) {
    redirect("/");
  }
  return <SignInPage />;
}

export const dynamic = "force-dynamic";
