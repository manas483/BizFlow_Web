/**
 * POST /api/v1/auth/token
 *
 * Mobile login endpoint. Accepts email + password, returns:
 *   - access_token  (HS256 JWT, 15 min)
 *   - refresh_token (64-byte opaque hex, 30 days, stored in DB)
 *
 * Works independently of NextAuth — browser cookies are NOT set.
 * Flutter stores the access_token in flutter_secure_storage.
 */

import { NextRequest }               from 'next/server';
import { prisma }                    from '@/lib/db';
import bcrypt                        from 'bcryptjs';
import { authRateLimit, emailRateLimit } from '@/lib/rate-limit';
import { ROLE_PERMISSIONS }          from '@/lib/permissions';
import {
  signAccessToken,
  generateRefreshToken,
  refreshTokenExpiresAt,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
} from '@/lib/mobile-jwt';
import {
  ok, created, err, validationError, rateLimited,
} from '@/lib/response';
import { z } from 'zod';

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit ────────────────────────────────────────────────────────────
    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const [ipRes, emailParsed] = await Promise.all([
      authRateLimit.limit(ip),
      req.json().then((b) => loginSchema.safeParse(b)).catch(() => ({ success: false as const })),
    ]);

    if (!ipRes.success) return rateLimited();

    if (!emailParsed.success) {
      return validationError((emailParsed as any).error?.issues ?? []);
    }

    const { email: rawEmail, password } = emailParsed.data;
    const email = rawEmail.toLowerCase().trim();

    const emailRes = await emailRateLimit.limit(email);
    if (!emailRes.success) return rateLimited();

    // ── Lookup user ───────────────────────────────────────────────────────────
    const DUMMY = '$2b$10$invalidhashforprotectionpurposesonly.....AAAAAAA';
    const user  = await prisma.user.findUnique({
      where:   { email },
      include: { business: true, employee: { select: { permissions: true } } },
    });

    const hashToCompare  = user?.password ?? DUMMY;
    const passwordValid  = bcrypt.compareSync(password, hashToCompare);

    if (!user || !user.password || !passwordValid) {
      return err('UNAUTHORIZED', 'Invalid email or password', 401);
    }
    if (!user.emailVerified) {
      return err('UNAUTHORIZED', 'Email address has not been verified', 401);
    }

    // ── Build effective permissions ───────────────────────────────────────────
    const roleDefaults: string[] = (ROLE_PERMISSIONS as any)[user.role] ?? [];
    const empPerms               = user.employee?.permissions;
    const permissions =
      Array.isArray(empPerms) && empPerms.length > 0
        ? (empPerms as string[])
        : roleDefaults;

    // ── Issue tokens ──────────────────────────────────────────────────────────
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({
        sub:          user.id,
        bid:          user.businessId,
        role:         user.role,
        email:        user.email,
        name:         user.name,
        permissions,
        businessType: user.business?.businessType,
      }),
      Promise.resolve(generateRefreshToken()),
    ]);

    const userAgent = req.headers.get('user-agent') ?? undefined;
    await prisma.refreshToken.create({
      data: {
        token:      refreshToken,
        userId:     user.id,
        businessId: user.businessId,
        expiresAt:  refreshTokenExpiresAt(),
        userAgent,
      },
    });

    return created({
      access_token:          accessToken,
      refresh_token:         refreshToken,
      token_type:            'Bearer',
      expires_in:            ACCESS_TOKEN_TTL_SECONDS,
      refresh_token_expires_in_days: REFRESH_TOKEN_TTL_DAYS,
      user: {
        id:           user.id,
        email:        user.email,
        name:         user.name,
        role:         user.role,
        businessId:   user.businessId,
        businessType: user.business?.businessType,
        permissions,
      },
    }, 'Login successful');

  } catch (e) {
    console.error('[POST /api/v1/auth/token]', e);
    return err('INTERNAL_ERROR', 'Internal Server Error', 500);
  }
}
