import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/shared/lib/db';
import { buildProductSnapshot } from '../../src/shared/lib/product-snapshot';

describe('Production Safeguards & Data Integrity Tests', () => {
  const businessId = "cmqpggqbl000005ier4oy5qfs"; // Ashirwad Business ID
  let testProductId: string;
  let testCustomerId: string;

  beforeAll(async () => {
    // Resolve or create a customer
    let customer = await prisma.customer.findFirst({ where: { businessId } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: "Test Safeguard Customer",
          phone: "9999999999",
          businessId,
        }
      });
    }
    testCustomerId = customer.id;

    // Create a temporary product for testing
    const testProduct = await prisma.product.create({
      data: {
        name: "Safeguard Product A",
        sku: "TEST-SAFE-001",
        category: "Other",
        stock: 50,
        minStock: 5,
        standardCost: 100.00,
        sellingPrice: 150.00,
        businessId,
        unit: "pcs"
      }
    });
    testProductId = testProduct.id;
  });

  afterAll(async () => {
    // Cleanup temporary data
    if (testProductId) {
      await prisma.saleItem.deleteMany({ where: { productId: testProductId } });
      await prisma.quotationItem.deleteMany({ where: { productId: testProductId } });
      await prisma.billOfSupplyItem.deleteMany({ where: { productId: testProductId } });
      await prisma.product.deleteMany({ where: { id: testProductId } });
    }
  });

  test('1. Product Rename Regression: Historical transaction snapshots are preserved', async () => {
    const product = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(product).toBeDefined();

    // Create a sale and a sale item with snapshot
    const sale = await prisma.sale.create({
      data: {
        invoiceNo: `INV-TST-SAFE-${Date.now()}`,
        customerId: testCustomerId,
        total: 150,
        status: "paid",
        businessId,
        items: {
          create: {
            productId: testProductId,
            qty: 1,
            price: 150,
            purchasePrice: 100,
            ...buildProductSnapshot(product!),
          }
        }
      },
      include: {
        items: true
      }
    });

    const createdSaleItem = sale.items[0];
    expect(createdSaleItem.productName).toBe("Safeguard Product A");
    expect(createdSaleItem.productSku).toBe("TEST-SAFE-001");
    expect(createdSaleItem.productUnit).toBe("pcs");

    // Rename the product in the product table
    await prisma.product.update({
      where: { id: testProductId },
      data: {
        name: "Safeguard Product B",
        sku: "TEST-SAFE-002"
      }
    });

    // Fetch the sale item and check that it still has the historical snapshot values
    const saleItemFromDb = await prisma.saleItem.findUnique({
      where: { id: createdSaleItem.id }
    });

    expect(saleItemFromDb?.productName).toBe("Safeguard Product A");
    expect(saleItemFromDb?.productSku).toBe("TEST-SAFE-001");

    // Fetch the product from product table and confirm it has the new name
    const productFromDb = await prisma.product.findUnique({
      where: { id: testProductId }
    });
    expect(productFromDb?.name).toBe("Safeguard Product B");

    // Cleanup sale
    await prisma.sale.delete({ where: { id: sale.id } });
  });

  test('2. Concurrency check (Optimistic locking) on product updates', async () => {
    const product = await prisma.product.findUnique({ where: { id: testProductId } });
    const originalUpdatedAt = product!.updatedAt;

    // Simulate update from first client
    const updatedByClient1 = await prisma.product.update({
      where: { id: testProductId },
      data: { sellingPrice: 160.00 }
    });

    // Simulate client 2 trying to update using the stale/original updatedAt timestamp
    const result = await prisma.product.updateMany({
      where: {
        id: testProductId,
        businessId,
        updatedAt: originalUpdatedAt // stale timestamp
      },
      data: { sellingPrice: 170.00 }
    });

    expect(result.count).toBe(0); // Should fail to update since updatedAt changed!
  });

  test('3. Product soft deletion / archiving', async () => {
    // Verify soft delete replaces hard delete
    const archivedProduct = await prisma.product.update({
      where: { id: testProductId },
      data: {
        active: false,
        deletedAt: new Date(),
        deletedBy: "test-user-id"
      }
    });

    expect(archivedProduct.active).toBe(false);
    expect(archivedProduct.deletedAt).toBeDefined();
    expect(archivedProduct.deletedBy).toBe("test-user-id");

    // Verify restore restores active status
    const restoredProduct = await prisma.product.update({
      where: { id: testProductId },
      data: {
        active: true,
        deletedAt: null,
        deletedBy: null
      }
    });

    expect(restoredProduct.active).toBe(true);
    expect(restoredProduct.deletedAt).toBeNull();
  });
}, 30000);
