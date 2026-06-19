import { prisma } from '../src/shared/lib/db';

async function main() {
  const products = await prisma.product.findMany({ select: { id: true, name: true, businessId: true }});
  console.log("Total products:", products.length);
  for (const p of products) {
    console.log(`- ${p.name} (Business: ${p.businessId})`);
  }

  const users = await prisma.user.findMany({ select: { email: true, businessId: true }});
  console.log("\nUsers:");
  for (const u of users) {
    console.log(`- ${u.email} (Business: ${u.businessId})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
