import { config } from 'dotenv';
config();
import { prisma } from './src/shared/lib/db.ts';

async function run() {
  const users = await prisma.user.count();
  console.log('Users in DB:', users);
  const products = await prisma.product.count();
  console.log('Products in DB:', products);
  const sales = await prisma.sale.count();
  console.log('Sales in DB:', sales);
}
run().catch(console.error).finally(() => process.exit(0));
