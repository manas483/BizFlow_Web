/**
 * POST /api/v1/auth/refresh
 *
 * Exchange a valid (non-revoked, non-expired) refresh_token for a new
 * access_token. The refresh_token itself is rotated: the old one is revoked
 * and a fresh one is issued, limiting the blast radius of token theft.
 */

import { NextRequest }         from 'next/server';
import { prisma }              from '@/shared/lib/db';
import { ROLE_PERMISSIONS }    from '@/shared/lib/permissions';
import {
  signAccessToken,
  generateRefreshToken,
  refreshTokenExpiresAt,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
} from '@/shared/lib/mobile-jwt';
import { created, err } from '@/shared/lib/response';
import { z }            from 'zod';

const schema = z.object({ refresh_token: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return err('VALIDATION_ERROR', 'refresh_token is required', 422);
    }

    const { refresh_token } = parsed.data;

    // ── Lookup + validate stored token ────────────────────────────────────────
    const stored = await prisma.refreshToken.findUnique({
      where:   { token: refresh_token },
      include: {
        user: {
          include: {
            business:  { select: { businessType: true } },
            employee:  { select: { permissions: true } },
          },
        },
      },
    });

    if (!stored)              return err('INVALID_TOKEN', 'Refresh token not found',  401);
    if (stored.revokedAt)     return err('INVALID_TOKEN', 'Refresh token revoked',    401);
    if (stored.expiresAt < new Date()) return err('TOKEN_EXPIRED', 'Refresh token expired', 401);

    const user = stored.user;
    if (!user.emailVerified)  return err('UNAUTHORIZED', 'Account not verified', 401);

    // ── Resolve permissions ───────────────────────────────────────────────────
    const roleDefaults: string[] = (ROLE_PERMISSIONS as any)[user.role] ?? [];
    const empPerms               = user.employee?.permissions;
    const permissions =
      Array.isArray(empPerms) && empPerms.length > 0
        ? (empPerms as string[])
        : roleDefaults;

    // ── Token rotation: revoke old, issue new ─────────────────────────────────
    const newRefreshToken = generateRefreshToken();
    const userAgent       = req.headers.get('user-agent') ?? stored.userAgent ?? undefined;

    const [accessToken] = await Promise.all([
      signAccessToken({
        sub:          user.id,
        bid:          user.businessId,
        role:         user.role,
        email:        user.email,
        name:         user.name,
        permissions,
        businessType: user.business?.businessType,
      }),
      prisma.$transaction([
        prisma.refreshToken.update({
          where: { id: stored.id },
          data:  { revokedAt: new Date() },
        }),
        prisma.refreshToken.create({
          data: {
            token:      newRefreshToken,
            userId:     user.id,
            businessId: user.businessId,
            expiresAt:  refreshTokenExpiresAt(),
            userAgent,
          },
        }),
      ]),
    ]);

    return created({
      access_token:                    accessToken,
      refresh_token:                   newRefreshToken,
      token_type:                      'Bearer',
      expires_in:                      ACCESS_TOKEN_TTL_SECONDS,
      refresh_token_expires_in_days:   REFRESH_TOKEN_TTL_DAYS,
    }, 'Tokens refreshed');

  } catch (e) {
    console.error('[POST /api/v1/auth/refresh]', e);
    return err('INTERNAL_ERROR', 'Internal Server Error', 500);
  }
}
