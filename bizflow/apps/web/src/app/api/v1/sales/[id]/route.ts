/**
 * GET    /api/v1/sales/[id]
 * PUT    /api/v1/sales/[id]
 * DELETE /api/v1/sales/[id]
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { ok, deleted, notFound, businessRule, validationError, internalError } from '@/lib/response';
import { z } from 'zod';

const updateSchema = z.object({
  paid:        z.number().min(0).optional(),
  paymentMode: z.string().optional(),
  notes:       z.string().optional(),
  status:      z.enum(['PAID', 'PARTIAL', 'UNPAID', 'CANCELLED']).optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id }  = await params;
    const sale    = await prisma.sale.findFirst({
      where:   { id, businessId: session.user.businessId },
      include: { customer: true, items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } } },
    });
    if (!sale) return notFound('Sale not found');
    return ok(sale);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id }  = await params;
    const exists  = await prisma.sale.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Sale not found');

    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);

    const data = parsed.data;
    const newPaid   = data.paid ?? exists.paid;
    const newStatus = data.status ?? (newPaid >= exists.total ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID');

    const sale = await prisma.$transaction(async (tx: any) => {
      if (data.paid !== undefined && data.paid !== exists.paid) {
        const diff = exists.total - data.paid;
        await tx.customer.update({ where: { id: exists.customerId }, data: { dues: { increment: diff - (exists.total - exists.paid) } } });
      }
      return tx.sale.update({ where: { id }, data: { ...data, paid: newPaid, status: newStatus } });
    });

    return ok(sale, { message: 'Sale updated' });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id }  = await params;
    const sale    = await prisma.sale.findFirst({ where: { id, businessId: session.user.businessId }, include: { items: true } });
    if (!sale) return notFound('Sale not found');

    await prisma.$transaction(async (tx: any) => {
      // Restore stock
      for (const item of sale.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.qty } } }).catch(() => {});
      }
      // Restore customer dues
      const outstanding = sale.total - sale.paid;
      if (outstanding > 0) {
        await tx.customer.update({ where: { id: sale.customerId }, data: { dues: { decrement: outstanding } } }).catch(() => {});
      }
      await tx.sale.delete({ where: { id } });
    });

    return deleted(id);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}
