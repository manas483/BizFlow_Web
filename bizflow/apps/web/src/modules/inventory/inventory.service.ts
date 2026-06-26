import { prisma } from '@/shared/lib/db';
import { recalculateTransportCosts } from '@/shared/lib/expense-calculations';
import { createLayerSafe } from '@/shared/lib/layer-engine';
import { CostingService } from './costing.service';

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
      prisma.product.findMany({ where, select: { stock: true, minStock: true, standardCost: true, sellingPrice: true } })
    ]);

    const productsWithCosts = await CostingService.computeProductAverageCosts(products, businessId);

    const stats = {
      lowStock: allFiltered.filter(p => p.stock <= p.minStock).length,
      totalValue: allFiltered.reduce((s, p) => s + (Math.max(0, p.stock) * p.standardCost), 0),
      totalSellValue: allFiltered.reduce((s, p) => s + (Math.max(0, p.stock) * p.sellingPrice), 0),
    };

    return { data: productsWithCosts, total, page, limit, totalPages: Math.ceil(total / limit), stats };
  }

  static async getProductById(id: string, businessId: string) {
    const product = await prisma.product.findFirst({ where: { id, businessId } });
    if (!product) return null;
    const [productWithCosts] = await CostingService.computeProductAverageCosts([product], businessId);
    return productWithCosts;
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
          notes: product.purchaseFrom || product.supplier || 'Initial stock on creation',
          referenceId: product.purchaseInvoiceNo,
          createdAt: product.purchaseDate || undefined,
          businessId: session.user.businessId,
        }
      });

      // 📦 Create initial inventory layer 📦
      const baseCost = product.standardCost * product.stock;
      const expenses: any[] = [];

      await createLayerSafe({
        itemId: product.id,
        receiptNo: product.purchaseInvoiceNo || undefined,
        receiptDate: product.purchaseDate || undefined,
        quantity: product.stock,
        purchaseCost: baseCost,
        expenses,
        supplierId: product.supplier || product.purchaseFrom || undefined,
        sourceTransactionType: 'purchase',
        businessId: session.user.businessId,
      });

      // Auto-create Accounts Payable for the purchase cost
      if (product.standardCost > 0) {
        const apAmount = product.stock * product.standardCost;
        const supplierName = product.supplier || product.purchaseFrom || product.name;
        const invoiceRef = product.purchaseInvoiceNo || `PROD-${product.id.slice(0, 8)}`;

        const payable = await prisma.accountsPayable.create({
          data: {
            supplierName,
            invoiceRef,
            amount: apAmount,
            paidAmount: 0,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            category: product.category || 'Purchase',
            status: 'OUTSTANDING',
            notes: `Auto-generated: Purchase of ${product.stock} × ${product.name}`,
            businessId: session.user.businessId,
          },
        });

        // Fire journal entry for the payable
        const { postPayableJournal } = await import('@/shared/lib/auto-journal');
        await postPayableJournal({
          payableId: payable.id,
          supplierName,
          amount: apAmount,
          category: 'Purchase',
          businessId: session.user.businessId,
        });
      }
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
            type: stockDiff > 0 ? 'IN' : 'ADJUST',
            quantity: stockDiff,
            notes: stockDiff > 0 ? (updated.purchaseFrom || updated.supplier || 'Restock during product update') : 'Manual stock reduction',
            referenceId: stockDiff > 0 ? updated.purchaseInvoiceNo : null,
            createdAt: (stockDiff > 0 && purchaseDate) ? new Date(purchaseDate) : undefined,
            businessId: session.user.businessId,
          }
        });

        // 📦 Create new inventory layer for restocking 📦
        if (stockDiff > 0) {
          const baseCost = updated.standardCost * stockDiff;
          const expenses: any[] = [];

          await createLayerSafe({
            itemId: updated.id,
            receiptNo: updated.purchaseInvoiceNo || undefined,
            receiptDate: purchaseDate ? new Date(purchaseDate) : undefined,
            quantity: stockDiff,
            purchaseCost: baseCost,
            expenses,
            supplierId: updated.supplier || updated.purchaseFrom || undefined,
            sourceTransactionType: 'purchase',
            businessId: session.user.businessId,
            tx,
          });
        }
      }
      return updated;
    });

    // Auto-create Accounts Payable for restocking (stock increased)
    if (stockDiff > 0 && (product.standardCost || 0) > 0) {
      const apAmount = stockDiff * product.standardCost;
      const supplierName = product.supplier || product.purchaseFrom || product.name;
      const invoiceRef = product.purchaseInvoiceNo || `RESTOCK-${product.id.slice(0, 8)}-${Date.now()}`;

      const payable = await prisma.accountsPayable.create({
        data: {
          supplierName,
          invoiceRef,
          amount: apAmount,
          paidAmount: 0,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          category: product.category || 'Purchase',
          status: 'OUTSTANDING',
          notes: `Auto-generated: Restocking ${stockDiff} × ${product.name}`,
          businessId: session.user.businessId,
        },
      });

      // Fire journal entry for the payable
      const { postPayableJournal } = await import('@/shared/lib/auto-journal');
      await postPayableJournal({
        payableId: payable.id,
        supplierName,
        amount: apAmount,
        category: 'Purchase',
        businessId: session.user.businessId,
      });
    }

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
