/**
 * GET    /api/v1/products/[id]
 * PUT    /api/v1/products/[id]
 * DELETE /api/v1/products/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma }                 from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { productSchema }          from '@/shared/lib/validations';
import { ok, deleted, notFound, validationError, internalError } from '@/shared/lib/response';

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
    const body    = await req.json();
    const clientUpdatedAt = body.updatedAt;

    const exists  = await prisma.product.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Product not found');

    const clientVersion = body.version;

    const parsed = productSchema.partial().safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues);

    if (typeof clientVersion === 'number') {
      const result = await prisma.product.updateMany({
        where: { id, businessId: session.user.businessId, version: clientVersion },
        data: {
          ...parsed.data,
          version: { increment: 1 }
        },
      });
      if (result.count === 0) {
        return NextResponse.json({
          success: false,
          code: "PRODUCT_CONFLICT",
          error: {
            code: "PRODUCT_CONFLICT",
            message: `This product was modified by another user. Current version in database is ${exists.version}. Please refresh and try again.`,
            meta: { currentVersion: exists.version, id: exists.id }
          },
          message: `This product was modified by another user. Current version in database is ${exists.version}. Please refresh and try again.`
        }, { status: 409 });
      }
    } else {
      await prisma.product.update({
        where: { id },
        data: {
          ...parsed.data,
          version: { increment: 1 }
        },
      });
    }

    const product = await prisma.product.findFirst({ where: { id, businessId: session.user.businessId } });
    return ok(product, { message: 'Product updated' });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id }  = await params;
    const exists  = await prisma.product.findFirst({ where: { id, businessId: session.user.businessId } });
    if (!exists) return notFound('Product not found');

    // ── Archive Validation ──
    // 1. Check active quotations
    const activeQuotation = await prisma.quotationItem.findFirst({
      where: {
        productId: id,
        quotation: {
          businessId: session.user.businessId,
          validUntil: { gte: new Date() }
        }
      }
    });
    if (activeQuotation) {
      return validationError([
        {
          message: "Product cannot be archived because it is associated with an active quotation."
        }
      ]);
    }

    // 2. Check active BOM component
    const activeBOMComponent = await prisma.billOfMaterialItem.findFirst({
      where: {
        productId: id,
        bom: {
          businessId: session.user.businessId,
          status: 'ACTIVE'
        }
      }
    });
    if (activeBOMComponent) {
      return validationError([
        {
          message: "Product cannot be archived because it is a component of an active Bill of Material."
        }
      ]);
    }

    // 3. Check active BOM finished good
    const activeBOMFinished = await prisma.billOfMaterial.findFirst({
      where: {
        finishedItemId: id,
        businessId: session.user.businessId,
        status: 'ACTIVE'
      }
    });
    if (activeBOMFinished) {
      return validationError([
        {
          message: "Product cannot be archived because it is the finished good of an active Bill of Material."
        }
      ]);
    }

    // 4. Check active stock count
    const activeStockCount = await prisma.stockCountItem.findFirst({
      where: {
        productId: id,
        stockCount: {
          businessId: session.user.businessId,
          status: { in: ['DRAFT', 'IN_PROGRESS'] }
        }
      }
    });
    if (activeStockCount) {
      return validationError([
        {
          message: "Product cannot be archived because it is part of a pending stock count."
        }
      ]);
    }

    // Validation passed, perform archive
    await prisma.product.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
        deletedBy: session.user.id,
      },
    });

    return deleted(id);
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}
