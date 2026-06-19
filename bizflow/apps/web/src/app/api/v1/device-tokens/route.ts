/**
 * POST   /api/v1/device-tokens        — register FCM token on login
 * DELETE /api/v1/device-tokens/[token] — deregister on logout
 * GET    /api/v1/device-tokens        — list tokens for current user (debug/admin)
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, created, validationError, internalError } from '@/shared/lib/response';
import { z } from 'zod';

const registerSchema = z.object({
  token:    z.string().min(1, 'FCM token is required'),
  platform: z.enum(['android', 'ios', 'web']),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const parsed  = registerSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);

    // Upsert: if same token exists (re-login), just update updatedAt
    const deviceToken = await prisma.deviceToken.upsert({
      where:  { token: parsed.data.token },
      update: { userId: session.user.id, platform: parsed.data.platform },
      create: { token: parsed.data.token, platform: parsed.data.platform, userId: session.user.id },
    });

    return created(deviceToken, 'Device token registered');
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error('[POST /api/v1/device-tokens]', e);
    return internalError();
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    // Admin-only: list all tokens for debugging / audit
    const tokens = await prisma.deviceToken.findMany({
      where:   { user: { businessId: session.user.businessId } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(tokens);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
