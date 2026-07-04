import NextAuth, { CredentialsSignin } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { authRateLimit, emailRateLimit } from "./rate-limit";
import { ROLE_PERMISSIONS } from "./permissions";
import { authConfig } from "./auth.config";
import { logger, requestContext } from "./logger";
import { authFailureBuffer } from "./auth-buffer";
import { getAuthErrorCode } from "./auth-errors";

class CustomAuthError extends CredentialsSignin {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.message = code;
  }
}

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
        const ip = req?.headers?.get?.("x-forwarded-for") ?? "127.0.0.1";
        const userAgent = req?.headers?.get?.("user-agent") ?? "Unknown";
        let email = "";
        
        logger.info({ category: "AUTH", event: "AUTHORIZE_START", message: "Authorize callback triggered", ip });

        try {
          if (!credentials?.email || !credentials?.password) {
            throw new CustomAuthError("EMAIL_PASSWORD_REQUIRED");
          }

          email = (credentials.email as string).toLowerCase().trim();
          const password = credentials.password as string;
          logger.info({ category: "AUTH", event: "CREDENTIALS_RECEIVED", message: "Step 1 ✅ Credentials received", email });

          const ipResult = await authRateLimit.limit(ip);
          if (!ipResult.success) throw new CustomAuthError("RATE_LIMIT_IP");

          const emailResult = await emailRateLimit.limit(email);
          if (!emailResult.success) throw new CustomAuthError("RATE_LIMIT_EMAIL");

          const dbStart = performance.now();
          const user = await prisma.user.findUnique({
            where: { email },
            include: {
              business: true,
              employee: { select: { permissions: true } },
            },
          });
          const dbDuration = Math.round(performance.now() - dbStart);
          
          if (user) {
            logger.info({ category: "AUTH", event: "USER_FOUND", message: `Step 2 ✅ User found in DB (${dbDuration}ms)`, email });
          }

          const DUMMY_HASH = "$2b$10$invalidhashforprotectionpurposesonly.....AAAAAAA";
          const hashToCompare = user?.password ?? DUMMY_HASH;
          
          const hashStart = performance.now();
          const isPasswordValid = bcrypt.compareSync(password, hashToCompare);
          const hashDuration = Math.round(performance.now() - hashStart);

          if (!user || !user.password || !isPasswordValid) {
            throw new CustomAuthError("INVALID_CREDENTIALS");
          }
          logger.info({ category: "AUTH", event: "PASSWORD_VERIFIED", message: `Step 3 ✅ Password verified (${hashDuration}ms)`, email });

          if (!user.emailVerified) {
            throw new CustomAuthError("EMAIL_NOT_VERIFIED");
          }

          if (user.twoFactorEnabled) {
            const otpToken = credentials.otpToken as string | undefined;
            if (!otpToken) throw new CustomAuthError("REQUIRES_2FA");

            if (!user.twoFactorSecret) throw new CustomAuthError("INVALID_CREDENTIALS");

            const { decryptSecret, verifyBackupCode, verifyTOTPToken } = require("./two-factor");
            const secret = decryptSecret(user.twoFactorSecret);

            let is2faValid = false;
            if (otpToken.length === 6) {
              is2faValid = verifyTOTPToken(secret, otpToken);
            } else {
              const codeIndex = await verifyBackupCode(user.backupCodes, otpToken);
              if (codeIndex !== -1) {
                is2faValid = true;
                const updatedCodes = [...user.backupCodes];
                updatedCodes.splice(codeIndex, 1);
                await prisma.user.update({
                  where: { id: user.id },
                  data: { backupCodes: updatedCodes },
                });
              }
            }

            if (!is2faValid) throw new CustomAuthError("INVALID_2FA_CODE");
          }

          const roleDefaults: string[] = (ROLE_PERMISSIONS as any)[user.role] ?? [];
          const empPerms = user.employee?.permissions;
          const effectivePermissions: string[] = Array.isArray(empPerms) && empPerms.length > 0
              ? (empPerms as string[])
              : roleDefaults;

          // Validate required fields
          if (!user.id || !user.email || !user.role || !user.businessId) {
            logger.error({ category: "AUTH", event: "USER_VALIDATION_FAILED", message: "Missing required fields on user object", email, id: user.id, role: user.role, businessId: user.businessId });
            throw new CustomAuthError("INVALID_USER_DATA");
          }

          const result = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            businessId: user.businessId,
            businessType: user.business?.businessType,
            permissions: effectivePermissions,
          };

          logger.info({ category: "AUTH", event: "AUTHORIZE_SUCCESS", message: "Step 4 ✅ Session payload generated", email });
          
          await prisma.authDiagnosticLog.create({
            data: { email, ipAddress: ip, userAgent, status: "SUCCESS" }
          }).catch(err => logger.error({ category: "AUTH", event: "LOG_WRITE_ERROR", message: "AuthLog success error", error: err }));

          return result;

        } catch (error: any) {
          const reason = error instanceof CustomAuthError ? error.code : "INTERNAL_ERROR";
          const errorCode = getAuthErrorCode(reason);
          
          // Log structured failure
          logger.error({ 
            category: "AUTH", 
            event: "AUTHORIZE_FAILED", 
            message: `Authorize failed [${errorCode}]: ${reason}`,
            errorCode,
            reason,
            error: error instanceof CustomAuthError ? undefined : error 
          });

          // Push to ring buffer
          const ctx = requestContext.getStore();
          authFailureBuffer.add({
            timestamp: new Date().toISOString(),
            reqId: ctx?.requestId,
            email,
            step: "AUTHORIZE",
            reason: `${errorCode} - ${reason}`,
            ip,
            userAgent
          });

          if (email) {
            try {
              await prisma.authDiagnosticLog.create({
                data: { email, ipAddress: ip, userAgent, status: "FAILED", reason }
              });
            } catch (logErr) {
              logger.error({ category: "AUTH", event: "LOG_WRITE_ERROR", message: "Failed to log auth error", error: logErr });
            }
          }
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session: updateSession }) {
      const now = Date.now();
      const jwtStart = performance.now();

      if (user) {
        token.role = user.role;
        token.businessId = user.businessId;
        token.id = user.id;
        token.businessType = (user as any).businessType;
        token.permissions = (user as any).permissions ?? [];
        token.sessionStart = now;
        token.lastActive = now;
        token.permissionsRefreshedAt = now;
        token.name = user.name;
        token.email = user.email;
        logger.info({ category: "AUTH", event: "JWT_CREATED", message: "Step 5 ✅ JWT callback invoked (initial sign-in)", userId: user.id });
      }

      const sessionStart = (token.sessionStart as number) || now;
      const lastActive = (token.lastActive as number) || now;

      const ABSOLUTE_LIMIT = 12 * 60 * 60 * 1000;
      if (now - sessionStart > ABSOLUTE_LIMIT) {
        logger.warn({ category: "AUTH", event: "SESSION_EXPIRED_ABSOLUTE", userId: token.id });
        throw new Error("SessionExpired");
      }

      const role = token.role as string;
      const isAdminOrFinance = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"].includes(role);
      const idleLimit = isAdminOrFinance ? 15 * 60 * 1000 : 60 * 60 * 1000;

      if (!user && (now - lastActive > idleLimit)) {
        logger.warn({ category: "AUTH", event: "SESSION_EXPIRED_IDLE", userId: token.id });
        throw new Error("SessionExpired");
      }

      token.lastActive = now;

      if (trigger === "update" && updateSession?.permissions) {
        token.permissions = updateSession.permissions;
        token.permissionsRefreshedAt = 0;
      }

      const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
      const g = globalThis as any;
      if (!g._authRefreshCache) g._authRefreshCache = new Map<string, number>();
      const refreshCache = g._authRefreshCache as Map<string, number>;
      
      const tokenRefresh = (token.permissionsRefreshedAt as number) || 0;
      const memRefresh = refreshCache.get(token.id as string) || 0;
      const lastRefresh = Math.max(tokenRefresh, memRefresh);

      if (token.id && (now - lastRefresh > REFRESH_INTERVAL_MS)) {
        const syncStart = performance.now();
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: { employee: { select: { permissions: true } } },
          });

          if (dbUser) {
            if (dbUser.sessionValidSince && dbUser.sessionValidSince.getTime() > sessionStart) {
              logger.warn({ category: "AUTH", event: "SESSION_REVOKED", userId: token.id });
              throw new Error("SessionRevoked");
            }
            const roleDefaults: string[] = (ROLE_PERMISSIONS as any)[dbUser.role] ?? [];
            const empPerms = dbUser.employee?.permissions;
            token.permissions = Array.isArray(empPerms) && empPerms.length > 0 ? (empPerms as string[]) : roleDefaults;
            token.role = dbUser.role;
            token.name = dbUser.name;
          } else {
            logger.warn({ category: "AUTH", event: "USER_NOT_FOUND", userId: token.id });
            throw new Error("UserNotFound");
          }
          token.permissionsRefreshedAt = now;
          refreshCache.set(token.id as string, now);
          
          logger.info({ category: "AUTH", event: "SESSION_SYNCED", message: `Session synced with DB in ${Math.round(performance.now() - syncStart)}ms`, userId: token.id });
        } catch (error: any) {
          const reason = ["SessionRevoked", "UserNotFound"].includes(error.message) ? error.message : "SESSION_SYNC_ERROR";
          const errorCode = getAuthErrorCode(reason === "UserNotFound" ? "USER_NOT_FOUND" : reason === "SessionRevoked" ? "SESSION_REVOKED" : "INTERNAL_ERROR");

          logger.error({ category: "AUTH", event: "SESSION_SYNC_ERROR", message: `Failed to sync session [${errorCode}]`, error });
          
          const ctx = requestContext.getStore();
          authFailureBuffer.add({
            timestamp: new Date().toISOString(),
            reqId: ctx?.requestId,
            step: "JWT_SYNC",
            reason: `${errorCode} - ${reason}`,
          });

          if (["SessionRevoked", "UserNotFound"].includes(error.message)) {
            throw error;
          }
        }
      }

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
        
        // Log on session refresh
        if (session.user.id) {
          logger.debug({ category: "AUTH", event: "SESSION_REFRESHED", message: "Step 6 ✅ Session callback invoked", userId: session.user.id });
        }
      }
      return session;
    },
  },
});
