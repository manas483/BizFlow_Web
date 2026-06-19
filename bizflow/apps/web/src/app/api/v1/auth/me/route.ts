/**
 * GET  /api/v1/auth/me       — return full current user + business info
 * POST /api/v1/auth/logout   — revoke the supplied refresh_token
 */

import { NextRequest }      from 'next/server';
import { prisma }           from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, err }          from '@/shared/lib/response';
import { z }                from 'zod';

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { id, businessId } = session.user;

    const [user, business] = await Promise.all([
      prisma.user.findUnique({
        where:   { id },
        include: { employee: { select: { phone: true, department: true, designation: true, salary: true, joinDate: true } } },
      }),
      prisma.business.findUnique({
        where:  { id: businessId },
        select: { id: true, name: true, businessType: true, plan: true, logoUrl: true, gstNumber: true, gstInclusive: true, phone: true, address: true },
      }),
    ]);

    if (!user) return err('NOT_FOUND', 'User not found', 404);

    return ok({
      user: {
        id:          user.id,
        email:       user.email,
        name:        user.name,
        role:        user.role,
        permissions: session.user.permissions,
        phone:       user.employee?.phone       ?? null,
        department:  user.employee?.department  ?? null,
        designation: user.employee?.designation ?? null,
      },
      business,
    });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error('[GET /api/v1/auth/me]', e);
    return err('INTERNAL_ERROR', 'Internal Server Error', 500);
  }
}
