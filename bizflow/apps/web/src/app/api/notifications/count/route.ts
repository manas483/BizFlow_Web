export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { getUnreadCount, markAllRead } from '@/shared/lib/notification-engine';

/**
 * GET — return unread notification count.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const userRole = (session.user as any).role as string;
    const count = await getUnreadCount(session.user.businessId, userRole, session.user.id);

    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST — mark all notifications as read.
 */
export async function POST() {
  try {
    const session = await requireAuth();
    const userRole = (session.user as any).role as string;
    const count = await markAllRead(session.user.businessId, userRole, session.user.id);

    return NextResponse.json({ markedRead: count });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

