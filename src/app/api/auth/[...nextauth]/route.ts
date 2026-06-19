// src/app/api/auth/[...nextauth]/route.ts
// NextAuth route handler — re-exports GET and POST from the shared auth config.
// FSAA exception: app/api/** may import from any layer.

import { handlers } from "@/shared/lib/auth";

export const { GET, POST } = handlers;
