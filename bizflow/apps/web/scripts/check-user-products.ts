import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'sachan.manas483@gmail.com';
  console.log(`Checking database for user: ${email}...`);
  
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, businessId: true, name: true }
  });
  
  if (!user) {
    console.log(`\n❌ User with email "${email}" was NOT found in the database.`);
    return;
  }
  
  const productCount = await prisma.product.count({
    where: { businessId: user.businessId }
  });
  
  const products = await prisma.product.findMany({
    where: { businessId: user.businessId },
    select: { name: true, sku: true, category: true, createdAt: true },
    take: 5
  });
  
  console.log(`\n✅ User Found: ${user.name} (Business ID: ${user.businessId})`);
  console.log(`📦 Total Products Added: ${productCount}`);
  
  if (products.length > 0) {
    console.log(`\nHere are the most recent 5 products for this account:`);
    console.table(products);
  } else {
    console.log(`\nThere are no products associated with this business account in the current database.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
