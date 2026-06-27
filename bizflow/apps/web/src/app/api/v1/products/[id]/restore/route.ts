import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { ok, notFound, internalError } from '@/shared/lib/response';

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
    const { id }  = await params;

    const exists = await prisma.product.findFirst({
      where: { id, businessId: session.user.businessId }
    });
    if (!exists) return notFound('Product not found');

    const warnings: string[] = [];

    // Check if category still exists in active products
    const otherProductWithCategory = await prisma.product.findFirst({
      where: {
        businessId: session.user.businessId,
        category: exists.category,
        active: true,
        id: { not: id }
      }
    });
    if (!otherProductWithCategory) {
      warnings.push(`Category "${exists.category}" no longer exists in any active products.`);
    }

    // Check if supplier still exists in active products
    if (exists.supplier) {
      const otherProductWithSupplier = await prisma.product.findFirst({
        where: {
          businessId: session.user.businessId,
          supplier: exists.supplier,
          active: true,
          id: { not: id }
        }
      });
      if (!otherProductWithSupplier) {
        warnings.push(`Supplier "${exists.supplier}" no longer exists in any active products.`);
      }
    }

    // Restore the product
    const restoredProduct = await prisma.product.update({
      where: { id },
      data: {
        active: true,
        deletedAt: null,
        deletedBy: null,
      },
    });

    return ok({
      product: restoredProduct,
      warnings
    }, { message: 'Product restored successfully' });
  } catch (e) {
    if (e instanceof AuthError) return e.response;
    console.error(e);
    return internalError();
  }
}
