import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });
neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Phase 0: Schema & Data Audit ===');
  
  // 1. Fetch a recent, healthy invoice with items
  const healthySale = await prisma.sale.findFirst({
    where: {
      items: {
        some: {}
      }
    },
    include: {
      items: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (!healthySale) {
    console.log('No healthy sale found to audit.');
    return;
  }

  console.log(`\nFound healthy sale: ${healthySale.invoiceNo} (ID: ${healthySale.id})`);
  console.log(`It has ${healthySale.items.length} items.`);
  console.log('\nSample SaleItem record:');
  console.log(JSON.stringify(healthySale.items[0], null, 2));

  console.log('\n=== Required Fields Template for SaleItem ===');
  console.log(`
  Based on schema.prisma and the healthy record, a reconstructed SaleItem must include:
  {
    "saleId": "<string>",
    "productId": "<string>",
    "qty": <number>,
    "price": <number>,
    "purchasePrice": <number> (usually 0 if unknown),
    "gstRate": <number>,
    "hsnCode": "<string|null>",
    "discount": <number>,
    "productName": "<string>",
    "productSku": "<string|null>",
    "productUnit": "<string|null>",
    "productHsnCode": "<string|null>",
    "productGstRate": <number|null>,
    "productCategory": "<string|null>",
    "originalPrice": <number|null>,
    "priceOverrideReason": "<string|null>",
    "saleQty": <number|null>,
    "saleUnit": "<string|null>",
    "isLoose": <boolean>,
    "packagingId": "<string|null>",
    "packagingLabel": "<string|null>"
  }
  `);

  console.log('Note: SaleItem does NOT have createdAt/updatedAt or businessId. It inherits entirely from the Sale record. Timestamps are perfectly preserved automatically.');

}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
