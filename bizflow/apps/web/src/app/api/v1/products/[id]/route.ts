/**
 * GET    /api/v1/products/[id]
 * PUT    /api/v1/products/[id]
 * DELETE /api/v1/products/[id]
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { productSchema }          from '@/lib/validations';
import { ok, deleted, notFound, validationError, internalError } from '@/lib/response';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session  = await requireAuth();
    const { id }   = await params;
    const product  = await prisma.product.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!product) return notFound('Product not found');
    return ok(product);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id }  = await params;
    const exists  = await prisma.product.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Product not found');

    const parsed = productSchema.partial().safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.issues);

    const { purchaseDate, ...rest } = parsed.data;
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(purchaseDate !== undefined ? { purchaseDate: purchaseDate ? new Date(purchaseDate) : null } : {}),
      },
    });
    return ok(product, { message: 'Product updated' });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id }  = await params;
    const exists  = await prisma.product.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Product not found');
    await prisma.product.delete({ where: { id } });
    return deleted(id);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    return internalError();
  }
}
