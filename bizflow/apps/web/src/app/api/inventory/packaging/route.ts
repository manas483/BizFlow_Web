export const dynamic = 'force-dynamic';
/**
 * GET  /api/inventory/packaging?productId=xxx  — List packaging options for a product
 * POST /api/inventory/packaging               — Create a new packaging option
 */

import { NextRequest }            from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { productPackagingSchema } from '@/shared/lib/validations';
import { ok, created, validationError, businessRule, internalError } from '@/shared/lib/response';

export async function GET(req: NextRequest) {
  try {
    const session  = await requireAuth();
    const biz      = session.user.businessId;
    const sp       = new URL(req.url).searchParams;
    const productId = sp.get('productId');

    if (!productId) {
      return validationError('productId query parameter is required');
    }

    // Verify product belongs to business
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId: biz },
      select: { id: true },
    });
    if (!product) {
      return businessRule('Product not found');
    }

    const packagingOptions = await prisma.productPackaging.findMany({
      where: { productId, active: true },
      orderBy: { sortOrder: 'asc' },
    });

    return ok(packagingOptions);
  } catch (err: any) {
    if (err instanceof AuthError) return err.response;
    return internalError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const biz     = session.user.businessId;
    const body    = await req.json();

    const { productId, ...packagingData } = body;

    if (!productId) {
      return validationError('productId is required');
    }

    // Validate packaging data
    const parsed = productPackagingSchema.safeParse(packagingData);
    if (!parsed.success) {
      return validationError(parsed.error.issues.map(i => i.message).join(', '));
    }

    // Verify product belongs to business and has loose sale enabled
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId: biz },
      select: { id: true, allowLooseSale: true },
    });
    if (!product) {
      return businessRule('Product not found');
    }
    if (!product.allowLooseSale) {
      return businessRule('Product does not have loose sale enabled');
    }

    const data = parsed.data;

    // If this is marked as purchase unit, unset any existing purchase unit
    if (data.isPurchaseUnit) {
      await prisma.productPackaging.updateMany({
        where: { productId, isPurchaseUnit: true },
        data: { isPurchaseUnit: false },
      });
    }

    // If this is marked as default, unset any existing default
    if (data.isDefault) {
      await prisma.productPackaging.updateMany({
        where: { productId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const packaging = await prisma.productPackaging.create({
      data: {
        productId,
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

    return created(packaging);
  } catch (err: any) {
    if (err instanceof AuthError) return err.response;
    return internalError(err);
  }
}
