const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const layer = await prisma.inventoryLayer.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { product: true }
  });
  console.log(JSON.stringify(layer, null, 2));
}
main().finally(() => { prisma.$disconnect(); });
