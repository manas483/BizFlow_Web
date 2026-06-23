export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

// PATCH /api/notifications/mark-read
// Body: { ids: string[] } — or empty to mark all as read
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const ids: string[] = body.ids ?? [];

    if (ids.length > 0) {
      // Mark specific notifications read
      await prisma.notification.updateMany({
        where: {
          id: { in: ids },
          businessId: session.user.businessId,
        },
        data: { read: true },
      });
    } else {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { businessId: session.user.businessId, read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

