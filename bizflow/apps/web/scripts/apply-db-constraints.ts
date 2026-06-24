import 'dotenv/config';
import { prisma } from '../src/shared/lib/db';

async function main() {
  console.log('Applying Data Integrity Constraints to InventoryLayer...');

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryLayer" DROP CONSTRAINT IF EXISTS check_remaining_qty;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryLayer" ADD CONSTRAINT check_remaining_qty CHECK ("remainingQty" >= 0);`);
    console.log('✅ Applied constraint: remainingQty >= 0');

    await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryLayer" DROP CONSTRAINT IF EXISTS check_unit_cost;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryLayer" ADD CONSTRAINT check_unit_cost CHECK ("unitCost" >= 0);`);
    console.log('✅ Applied constraint: unitCost >= 0');

    await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryLayer" DROP CONSTRAINT IF EXISTS check_landed_cost;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryLayer" ADD CONSTRAINT check_landed_cost CHECK ("landedCost" >= "purchaseCost");`);
    console.log('✅ Applied constraint: landedCost >= purchaseCost');

    console.log('All DB constraints applied successfully!');
  } catch (error) {
    console.error('Failed to apply constraints:', error);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
