import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { authRateLimit, emailRateLimit } from "./rate-limit";
import { ROLE_PERMISSIONS } from "./permissions";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otpToken: { label: "OTP Token", type: "text" },
      },
      async authorize(credentials, req) {
        // ── 1. Basic field check ────────────────────────────────────────────
        if (!credentials?.email || !credentials?.password) {
          throw new Error("EMAIL_PASSWORD_REQUIRED");
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        // ── 2. IP-level rate limiting ────────────────────────────────────────
        const ip = req?.headers?.get?.("x-forwarded-for") ?? "127.0.0.1";
        const ipResult = await authRateLimit.limit(ip);
        if (!ipResult.success) {
          throw new Error("RATE_LIMIT_IP");
        }

        // ── 3. Per-email rate limiting (catches IP-rotating attackers) ───────
        const emailResult = await emailRateLimit.limit(email);
        if (!emailResult.success) {
          throw new Error("RATE_LIMIT_EMAIL");
        }

        // ── 4. Find user ─────────────────────────────────────────────────────
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            business: true,
            // Load the employee record to get custom permissions
            employee: { select: { permissions: true } },
          },
        });

        // Timing-safe: always run bcrypt even if user is not found.
        const DUMMY_HASH =
          "$2b$10$invalidhashforprotectionpurposesonly.....AAAAAAA";
        const hashToCompare = user?.password ?? DUMMY_HASH;
        const isPasswordValid = bcrypt.compareSync(password, hashToCompare);

        if (!user || !user.password || !isPasswordValid) {
          throw new Error("INVALID_CREDENTIALS");
        }

        // ── 5. Block unverified accounts ─────────────────────────────────────
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // ── 5.5. Check two-factor authentication ──────────────────────────────
        if (user.twoFactorEnabled) {
          const otpToken = credentials.otpToken as string | undefined;
          if (!otpToken) {
            // Throw a custom error that client-side login can check for
            throw new Error("REQUIRES_2FA");
          }

          if (!user.twoFactorSecret) {
            throw new Error("INVALID_CREDENTIALS");
          }

          const { decryptSecret, verifyBackupCode, verifyTOTPToken } = require("./two-factor");
          const secret = decryptSecret(user.twoFactorSecret);

          let is2faValid = false;

          if (otpToken.length === 6) {
            is2faValid = verifyTOTPToken(secret, otpToken);
          } else {
            const codeIndex = await verifyBackupCode(user.backupCodes, otpToken);
            if (codeIndex !== -1) {
              is2faValid = true;
              // Remove the used backup code
              const updatedCodes = [...user.backupCodes];
              updatedCodes.splice(codeIndex, 1);
              await prisma.user.update({
                where: { id: user.id },
                data: { backupCodes: updatedCodes },
              });
            }
          }

          if (!is2faValid) {
            throw new Error("INVALID_2FA_CODE");
          }
        }

        // ── 6. Resolve effective permissions ─────────────────────────────────
        // Employee.permissions is stored as a string array of granted permissions,
        // e.g. ["view_dashboard", "manage_inventory", "manage_sales"]
        // If set, it overrides the role defaults entirely (admin explicitly chose them).
        // If null/empty, fall back to the role's default permission set.
        const roleDefaults: string[] =
          (ROLE_PERMISSIONS as any)[user.role] ?? [];

        const empPerms = user.employee?.permissions;
        const effectivePermissions: string[] =
          Array.isArray(empPerms) && empPerms.length > 0
            ? (empPerms as string[])
            : roleDefaults;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId,
          businessType: user.business?.businessType,
          permissions: effectivePermissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session: updateSession }) {
      // On initial sign-in — store everything from authorize()
      if (user) {
        token.role = user.role;
        token.businessId = user.businessId;
        token.id = user.id;
        token.businessType = (user as any).businessType;
        token.permissions = (user as any).permissions ?? [];
      }

      // On manual session update (e.g. after admin edits permissions)
      if (trigger === "update" && updateSession?.permissions) {
        token.permissions = updateSession.permissions;
        token.permissionsRefreshedAt = 0; // Force refresh on next request
      }

      // ── Throttled live permissions refresh ───────────────────────────────
      // Refresh permissions from DB at most once every 5 minutes.
      // Previously this ran on EVERY request, causing a DB round-trip
      // on every page load / API call — catastrophic with serverless DB
      // cold starts (200-500ms each). Now we cache in the JWT itself.
      const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
      const lastRefresh = (token.permissionsRefreshedAt as number) || 0;
      const now = Date.now();

      if (token.id && (now - lastRefresh > REFRESH_INTERVAL_MS)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: { employee: { select: { permissions: true } } },
          });
          if (dbUser) {
            const roleDefaults: string[] =
              (ROLE_PERMISSIONS as any)[dbUser.role] ?? [];
            const empPerms = dbUser.employee?.permissions;
            token.permissions =
              Array.isArray(empPerms) && empPerms.length > 0
                ? (empPerms as string[])
                : roleDefaults;
            token.role = dbUser.role;
            token.name = dbUser.name;
          }
          token.permissionsRefreshedAt = now;
        } catch {
          // Non-fatal — keep cached permissions if DB temporarily unavailable
        }
      }

      // On manual session update for user profile
      if (trigger === "update" && updateSession?.name) {
        token.name = updateSession.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
        session.user.businessId = token.businessId as string;
        (session.user as any).businessType = token.businessType as string;
        (session.user as any).permissions = (token.permissions ?? []) as string[];
      }
      return session;
    },
  },
});

