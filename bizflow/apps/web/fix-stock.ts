import { prisma } from './src/shared/lib/db';

async function main() {
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
    include: { stockMovements: { where: { type: 'IN' } } }
  });

  let count = 0;
  for (const p of products) {
    if (p.stockMovements.length === 0) {
      console.log(`Fixing product ${p.name}`);
      await prisma.stockMovement.create({
        data: {
          productId: p.id,
          type: 'IN',
          quantity: p.stock,
          notes: p.purchaseFrom || p.supplier || 'Initial stock (backfilled)',
          referenceId: p.purchaseInvoiceNo || null,
          createdAt: p.purchaseDate || p.createdAt,
          businessId: p.businessId
        }
      });
      count++;
    }
  }
  console.log(`Backfilled stock movements for ${count} products.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
