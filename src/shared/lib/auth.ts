// src/shared/lib/auth.ts
// Auth.js v5 configuration — server-only module.
// Google OAuth provider with optional single-user gate via ALLOWED_EMAIL.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Allowed email for the single-user gate.
 * If set, only this Google account can log in.
 * If unset, any Google account is accepted (still OAuth-gated).
 */
const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL;

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/signin",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    /**
     * Single-user gate: deny login if ALLOWED_EMAIL is set and the
     * authenticated email doesn't match.
     */
    signIn({ user }) {
      if (!ALLOWED_EMAIL) return true;
      return user.email === ALLOWED_EMAIL;
    },
    /**
     * Route protection: require authentication for all protected routes.
     * API routes are handled separately in their handlers.
     */
    authorized({ auth: session }) {
      return !!session?.user;
    },
    /**
     * Only include the email in the session token (needed for the gate check
     * and for displaying the user identity in the UI).
     */
    jwt({ token, profile }) {
      if (profile?.email) {
        token.email = profile.email;
      }
      return token;
    },
    session({ session, token }) {
      if (token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
});
