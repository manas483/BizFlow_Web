/**
 * PATCH  /api/v1/notifications/[id]        — mark single notification as read
 * DELETE /api/v1/notifications/[id]        — delete notification (admin)
 *
 * POST   /api/v1/notifications/mark-all-read — mark all as read for current user
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, deleted, notFound, internalError } from '@/shared/lib/response';

export async function PATCH(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id }  = await params;
    const exists  = await prisma.notification.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Notification not found');
    const note = await prisma.notification.update({ where: { id }, data: { read: true } });
    return ok(note, { message: 'Marked as read' });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const { id }  = await params;
    const exists  = await prisma.notification.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Notification not found');
    await prisma.notification.delete({ where: { id } });
    return deleted(id);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
