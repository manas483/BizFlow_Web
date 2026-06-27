import { prisma } from './src/shared/lib/db';
async function main() {
  try {
    const product = await prisma.product.findFirst({
      where: {
        inventoryLayers: { some: {} } // find one with layers to test cascade
      }
    });
    if (!product) return console.log('No product with layers found');
    console.log('Attempting to delete product:', product.id);
    await prisma.product.delete({ where: { id: product.id } });
    console.log('Deleted successfully');
  } catch(e) {
    console.error('Delete failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
