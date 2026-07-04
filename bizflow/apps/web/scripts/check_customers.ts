import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const walkIn = await prisma.customer.findFirst({ where: { name: 'Walk-in Customer' } });
  
  if (walkIn) {
      const salesForWalkIn = await prisma.sale.count({ where: { customerId: walkIn.id } });
      console.log(`Sales for Walk-in Customer: ${salesForWalkIn}`);
  } else {
      console.log("No Walk-in Customer found.");
  }
  
  const allCustomers = await prisma.customer.count();
  const allSales = await prisma.sale.count();
  console.log(`Total Customers: ${allCustomers}`);
  console.log(`Total Sales: ${allSales}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
