/**
 * DELETE /api/v1/device-tokens/[token]
 *
 * Deregister a specific FCM token on logout.
 * The user can only delete their own tokens.
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { ok, notFound, forbidden, internalError } from '@/lib/response';

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session    = await requireAuth();
    const { token }  = await params;

    const existing = await prisma.deviceToken.findUnique({ where: { token } });
    if (!existing) return notFound('Device token not found');

    // Security: users can only deregister their own tokens
    if (existing.userId !== session.user.id && session.user.role !== 'SUPER_ADMIN') {
      return forbidden('Cannot deregister another user\'s device token');
    }

    await prisma.deviceToken.delete({ where: { token } });
    return ok({ deregistered: true }, { message: 'Device token removed' });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error('[DELETE /api/v1/device-tokens/[token]]', e);
    return internalError();
  }
}
