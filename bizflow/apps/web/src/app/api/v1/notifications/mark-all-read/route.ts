/**
 * POST /api/v1/notifications/mark-all-read
 *
 * Marks ALL unread notifications as read for the current user's role.
 * Flutter calls this on notification list "Mark all read" button.
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { ok, internalError }      from '@/lib/response';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const role    = session.user.role;

    const result = await prisma.notification.updateMany({
      where: {
        businessId: session.user.businessId,
        read:       false,
        OR: [
          { targetRole: null },
          { targetRole: role },
          { userId: session.user.id },
        ],
      },
      data: { read: true },
    });

    return ok({ markedCount: result.count }, { message: `${result.count} notifications marked as read` });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
