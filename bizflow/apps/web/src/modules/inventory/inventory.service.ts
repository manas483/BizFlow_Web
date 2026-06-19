import { prisma } from '@/shared/lib/db';
import { recalculateTransportCosts } from '@/shared/lib/expense-calculations';

export class InventoryService {
  static async getProducts(businessId: string, search?: string | null, category?: string | null, page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const where = {
      businessId,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(category ? { category } : {}),
    };

    const [products, total, allFiltered] = await Promise.all([
      prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.product.count({ where }),
      prisma.product.findMany({ where, select: { stock: true, minStock: true, purchasePrice: true, sellingPrice: true } })
    ]);

    const stats = {
      lowStock: allFiltered.filter(p => p.stock <= p.minStock).length,
      totalValue: allFiltered.reduce((s, p) => s + (Math.max(0, p.stock) * p.purchasePrice), 0),
      totalSellValue: allFiltered.reduce((s, p) => s + (Math.max(0, p.stock) * p.sellingPrice), 0),
    };

    return { data: products, total, page, limit, totalPages: Math.ceil(total / limit), stats };
  }

  static async getProductById(id: string, businessId: string) {
    return prisma.product.findFirst({ where: { id, businessId } });
  }

  static async createProduct(data: any, session: any) {
    const { purchaseDate, ...rest } = data;
    const product = await prisma.product.create({
      data: {
        ...rest,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        businessId: session.user.businessId,
      }
    });

    if (product.stock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: 'IN',
          quantity: product.stock,
          notes: 'Initial stock on creation',
          businessId: session.user.businessId,
        }
      });
    }

    await recalculateTransportCosts(session.user.businessId);

    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'CREATE',
      entityType: 'Product',
      entityId: product.id,
      entityLabel: product.name,
    });

    await (prisma as any).userActivity.create({
      data: {
        businessId: session.user.businessId,
        userId: session.user.id ?? "unknown",
        eventType: "product_add",
        metadata: { productId: product.id, category: product.category },
      }
    });

    return product;
  }

  static async updateProduct(id: string, existing: any, data: any, session: any) {
    const { purchaseDate, ...rest } = data;
    
    // Check if stock is manually changed (not through adjustStock)
    const stockDiff = (data.stock ?? existing.stock) - existing.stock;

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...rest,
          ...(purchaseDate !== undefined ? { purchaseDate: purchaseDate ? new Date(purchaseDate) : null } : {}),
        },
      });

      if (stockDiff !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: updated.id,
            type: 'ADJUST',
            quantity: stockDiff,
            notes: 'Manual stock adjustment during product update',
            businessId: session.user.businessId,
          }
        });
      }
      return updated;
    });

    await recalculateTransportCosts(session.user.businessId);

    const { logAudit, computeChanges } = await import('@/shared/lib/audit');
    const changes = computeChanges(existing, product);
    if (changes) {
      await logAudit({
        session,
        action: 'UPDATE',
        entityType: 'Product',
        entityId: product.id,
        entityLabel: product.name,
        changes,
      });
    }

    return product;
  }

  static async deleteProduct(id: string, existing: any, session: any) {
    await prisma.product.delete({ where: { id } });
    await recalculateTransportCosts(session.user.businessId);

    const { logAudit } = await import('@/shared/lib/audit');
    await logAudit({
      session,
      action: 'DELETE',
      entityType: 'Product',
      entityId: id,
      entityLabel: existing.name,
    });
    return { success: true };
  }

  static async adjustStock(productId: string, quantity: number, type: 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER', businessId: string, notes?: string, referenceId?: string, warehouseId?: string) {
    if (quantity === 0) return null;

    return prisma.$transaction(async (tx) => {
      // Create movement
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          warehouseId,
          type,
          quantity,
          notes,
          referenceId,
          businessId,
        }
      });

      // Update product stock (atomically)
      await tx.product.update({
        where: { id: productId },
        data: {
          stock: {
            increment: quantity
          }
        }
      });

      return movement;
    });
  }
}
