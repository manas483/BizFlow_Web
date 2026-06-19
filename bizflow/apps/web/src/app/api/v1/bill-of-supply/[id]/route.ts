/**
 * GET    /api/v1/bill-of-supply/[id]
 * DELETE /api/v1/bill-of-supply/[id]
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, deleted, notFound, internalError } from '@/shared/lib/response';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id }  = await params;
    const bill    = await prisma.billOfSupply.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!bill) return notFound('Bill of supply not found');
    return ok(bill);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id }  = await params;
    const exists  = await prisma.billOfSupply.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Bill of supply not found');
    await prisma.billOfSupply.delete({ where: { id } });
    return deleted(id);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
