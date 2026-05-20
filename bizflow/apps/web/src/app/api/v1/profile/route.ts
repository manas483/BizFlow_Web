/**
 * GET /api/v1/profile
 * PUT /api/v1/profile
 *
 * Current authenticated user's own profile.
 * For mobile: Flutter profile page and settings screen.
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { ok, notFound, validationError, internalError } from '@/lib/response';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const user    = await prisma.user.findUnique({
      where:   { id: session.user.id },
      select:  { id: true, email: true, name: true, role: true, createdAt: true,
                 employee: { select: { id: true, phone: true, department: true, designation: true, salary: true, joinDate: true, status: true } } },
    });
    if (!user) return notFound('User not found');
    return ok({
      ...user,
      permissions: session.user.permissions,
      businessId:  session.user.businessId,
    });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();
    const parsed  = profileUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);

    const user = await prisma.user.update({
      where:  { id: session.user.id },
      data:   parsed.data,
      select: { id: true, email: true, name: true, role: true },
    });
    return ok(user, { message: 'Profile updated' });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
