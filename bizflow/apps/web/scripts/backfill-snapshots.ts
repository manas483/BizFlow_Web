import 'dotenv/config';
import { prisma } from '../src/shared/lib/db';

async function main() {
  console.log('Starting backfill for Immutable Transaction Snapshots...');

  // ── 1. Backfill SaleItem records ──
  const saleItems = await prisma.saleItem.findMany({
    where: {
      productName: null,
    },
    include: {
      product: true,
    },
  });

  console.log(`Found ${saleItems.length} SaleItem records to backfill.`);
  let saleItemCount = 0;
  for (const item of saleItems) {
    if (item.product) {
      await prisma.saleItem.update({
        where: { id: item.id },
        data: {
          productName: item.product.name,
          productSku: item.product.sku,
          productUnit: item.product.unit,
          productHsnCode: item.product.hsnCode,
          productGstRate: item.product.gstRate,
          productCategory: item.product.category,
        },
      });
      saleItemCount++;
    }
  }
  console.log(`Successfully backfilled ${saleItemCount} SaleItem records.`);

  // ── 2. Backfill BillOfSupplyItem records ──
  const billItems = await prisma.billOfSupplyItem.findMany({
    where: {
      productName: null,
    },
    include: {
      product: true,
    },
  });

  console.log(`Found ${billItems.length} BillOfSupplyItem records to backfill.`);
  let billItemCount = 0;
  for (const item of billItems) {
    if (item.product) {
      await prisma.billOfSupplyItem.update({
        where: { id: item.id },
        data: {
          productName: item.product.name,
          productSku: item.product.sku,
          productUnit: item.product.unit,
          productHsnCode: item.product.hsnCode,
          productGstRate: item.product.gstRate,
          productCategory: item.product.category,
        },
      });
      billItemCount++;
    }
  }
  console.log(`Successfully backfilled ${billItemCount} BillOfSupplyItem records.`);

  // ── 3. Backfill QuotationItem records ──
  const quoteItems = await prisma.quotationItem.findMany({
    where: {
      productName: null,
    },
    include: {
      product: true,
    },
  });

  console.log(`Found ${quoteItems.length} QuotationItem records to backfill.`);
  let quoteItemCount = 0;
  for (const item of quoteItems) {
    if (item.product) {
      await prisma.quotationItem.update({
        where: { id: item.id },
        data: {
          productName: item.product.name,
          productSku: item.product.sku,
          productUnit: item.product.unit,
          productHsnCode: item.product.hsnCode,
          productGstRate: item.product.gstRate,
          productCategory: item.product.category,
        },
      });
      quoteItemCount++;
    }
  }
  console.log(`Successfully backfilled ${quoteItemCount} QuotationItem records.`);
  console.log('Backfill process complete.');
}

main()
  .catch((err) => {
    console.error('Error during backfill:', err);
  })
  .finally(() => prisma.$disconnect());
