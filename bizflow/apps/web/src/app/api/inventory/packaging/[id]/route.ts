export const dynamic = 'force-dynamic';
/**
 * PUT    /api/inventory/packaging/[id] — Update a packaging option
 * DELETE /api/inventory/packaging/[id] — Soft-delete (set active=false)
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { productPackagingSchema } from '@/shared/lib/validations';
import { ok, validationError, businessRule, internalError } from '@/shared/lib/response';

type Context = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: Context) {
  try {
    const session     = await requireAuth();
    const biz         = session.user.businessId;
    const { id }      = await context.params;
    const body        = await req.json();

    // Verify packaging exists and product belongs to business
    const existing = await prisma.productPackaging.findUnique({
      where: { id },
      include: { product: { select: { businessId: true } } },
    });
    if (!existing || existing.product.businessId !== biz) {
      return businessRule('Packaging option not found');
    }

    const parsed = productPackagingSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.issues.map(i => i.message).join(', '));
    }

    const data = parsed.data;

    // If setting as purchase unit, unset others
    if (data.isPurchaseUnit && !existing.isPurchaseUnit) {
      await prisma.productPackaging.updateMany({
        where: { productId: existing.productId, isPurchaseUnit: true, id: { not: id } },
        data: { isPurchaseUnit: false },
      });
    }

    // If setting as default, unset others
    if (data.isDefault && !existing.isDefault) {
      await prisma.productPackaging.updateMany({
        where: { productId: existing.productId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.productPackaging.update({
      where: { id },
      data: {
        label: data.label,
        unit: data.unit,
        conversionFactor: data.conversionFactor,
        defaultPrice: data.defaultPrice ?? null,
        isPurchaseUnit: data.isPurchaseUnit,
        isLoose: data.isLoose,
        isDefault: data.isDefault,
        sortOrder: data.sortOrder,
        active: data.active,
      },
    });

    return ok(updated);
  } catch (err: any) {
    if (err instanceof AuthError) return err.response;
    return internalError(err);
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const session     = await requireAuth();
    const biz         = session.user.businessId;
    const { id }      = await context.params;

    const existing = await prisma.productPackaging.findUnique({
      where: { id },
      include: { product: { select: { businessId: true } } },
    });
    if (!existing || existing.product.businessId !== biz) {
      return businessRule('Packaging option not found');
    }

    // Don't allow deactivating the only purchase unit
    if (existing.isPurchaseUnit) {
      return businessRule('Cannot deactivate the primary purchase unit packaging. Set another packaging as purchase unit first.');
    }

    const updated = await prisma.productPackaging.update({
      where: { id },
      data: { active: false },
    });

    return ok(updated);
  } catch (err: any) {
    if (err instanceof AuthError) return err.response;
    return internalError(err);
  }
}
