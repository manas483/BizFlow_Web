import type { NextAuthConfig } from "next-auth";

// This file contains the NextAuth configuration without any Node.js or Prisma dependencies.
// It is safely imported by the Edge runtime in middleware.ts.
export const authConfig = {
  providers: [], // Providers are appended in auth.ts
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
} satisfies NextAuthConfig;
