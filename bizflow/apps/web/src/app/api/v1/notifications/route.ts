/**
 * GET  /api/v1/notifications   — paginated notification list (role-filtered)
 * POST /api/v1/notifications   — create notification (admin)
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, created, validationError, internalError, parsePagination, buildPagination } from '@/shared/lib/response';
import { z } from 'zod';

const notificationSchema = z.object({
  title:      z.string().min(1),
  message:    z.string().min(1),
  type:       z.string().default('info'),
  targetRole: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const session  = await requireAuth();
    const sp       = new URL(req.url).searchParams;
    const { page, limit, skip, sortDir } = parsePagination(sp);
    const unreadOnly = sp.get('unread') === 'true';
    const userRole   = session.user.role;

    const where: any = {
      businessId: session.user.businessId,
      OR: [{ targetRole: null }, { targetRole: userRole }],
      ...(unreadOnly ? { read: false } : {}),
    };

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: sortDir }, skip, take: limit }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, read: false } }),
    ]);

    return ok(data, {
      pagination: buildPagination(total, page, limit),
      meta: { unreadCount },
    });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const parsed  = notificationSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);

    const notification = await prisma.notification.create({
      data: { ...parsed.data, businessId: session.user.businessId },
    });

    return created(notification);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}
