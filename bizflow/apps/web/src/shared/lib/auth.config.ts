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
    maxAge: 7 * 24 * 60 * 60, // 7 days (Remember Me limit)
    updateAge: 15 * 60, // 15 minutes
  },
  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  useSecureCookies: process.env.NODE_ENV === "production",
} satisfies NextAuthConfig;
