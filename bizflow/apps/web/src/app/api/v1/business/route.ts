export const dynamic = 'force-dynamic';
/** GET /api/v1/business  — fetch business info
 *  PUT /api/v1/business  — update (SUPER_ADMIN) */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { businessUpdateSchema }   from '@/shared/lib/validations';
import { ok, notFound, validationError, internalError } from '@/shared/lib/response';

export async function GET(req: NextRequest) {
  try {
    const session  = await requireAuth();
    const business = await prisma.business.findUnique({ where: { id: session.user.businessId } });
    if (!business) return notFound('Business not found');
    return ok(business);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth(['SUPER_ADMIN']);
    const parsed  = businessUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);
    const business = await prisma.business.update({ where: { id: session.user.businessId }, data: parsed.data });
    return ok(business, { message: 'Business updated' });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

