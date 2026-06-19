// middleware.ts
// Route protection via Auth.js v5.
// Unauthenticated requests to protected routes are redirected to the sign-in page.
// API routes receive a 401 JSON response.
// /api/auth/* is automatically allowed by the authorized callback.

import { auth } from "@/shared/lib/auth";

export default auth;

export const config = {
  // Protect all routes except Next.js internals, static files, and Auth.js API routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/).*)"],
};
