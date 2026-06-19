const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.example' }); // using .env.example if .env is missing or just let prisma find it

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  const products = await prisma.product.findMany();
  console.log("Total products in DB:", products.length);
  
  const businesses = await prisma.business.findMany({
    select: { id: true, name: true }
  });
  
  for (const b of businesses) {
    const count = await prisma.product.count({ where: { businessId: b.id } });
    console.log(`Business ${b.name} (${b.id}) has ${count} products.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
