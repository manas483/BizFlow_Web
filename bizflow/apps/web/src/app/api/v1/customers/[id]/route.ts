/**
 * GET    /api/v1/customers/[id]
 * PUT    /api/v1/customers/[id]
 * DELETE /api/v1/customers/[id]
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { customerSchema }         from '@/shared/lib/validations';
import { ok, deleted, notFound, validationError, internalError } from '@/shared/lib/response';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session  = await requireAuth();
    const { id }   = await params;
    const customer = await prisma.customer.findFirst({ where: { id, businessId: session.user.businessId, deletedAt: null } });
    if (!customer) return notFound('Customer not found');
    return ok(customer);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id }  = await params;
    const exists  = await prisma.customer.findFirst({ where: { id, businessId: session.user.businessId, deletedAt: null } });
    if (!exists) return notFound('Customer not found');

    const parsed = customerSchema.partial().safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);

    const dataToUpdate: any = { ...parsed.data };
    if (dataToUpdate.phone === null) dataToUpdate.phone = '';

    const customer = await prisma.customer.update({ where: { id }, data: dataToUpdate });
    return ok(customer, { message: 'Customer updated' });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id }  = await params;
    const exists  = await prisma.customer.findFirst({ where: { id, businessId: session.user.businessId, deletedAt: null } });
    if (!exists) return notFound('Customer not found');
    await prisma.customer.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: session.user.id } });
    return deleted(id);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
