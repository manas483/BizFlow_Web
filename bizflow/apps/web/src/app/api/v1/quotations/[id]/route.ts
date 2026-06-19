/**
 * GET    /api/v1/quotations/[id]
 * DELETE /api/v1/quotations/[id]
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, deleted, notFound, internalError } from '@/shared/lib/response';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session  = await requireAuth();
    const { id }   = await params;
    const quotation = await prisma.quotation.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!quotation) return notFound('Quotation not found');
    return ok(quotation);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id }  = await params;
    const exists  = await prisma.quotation.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Quotation not found');
    await prisma.quotation.delete({ where: { id } });
    return deleted(id);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
