import { prisma } from '../src/shared/lib/db';
import * as fs from 'fs';
import { parse } from 'csv-parse';

async function main() {
  const business = await prisma.business.findFirst({
    where: { name: 'BizFlow' }
  });

  if (!business) {
    throw new Error('Business not found');
  }

  const csvPath = 'c:\\\\Users\\\\sacha\\\\Desktop\\\\B\\\\bizflow\\\\docs\\\\inventory_export (1).csv';
  console.log(`Reading CSV from ${csvPath}`);
  
  const parser = fs.createReadStream(csvPath).pipe(parse({
    columns: true,
    skip_empty_lines: true
  }));

  let count = 0;
  for await (const row of parser) {
    await prisma.product.create({
      data: {
        sku: row['SKU'],
        name: row['Name'],
        category: row['Category'],
        stock: parseInt(row['Stock'], 10) || 0,
        minStock: parseInt(row['Min Stock'], 10) || 0,
        standardCost: parseFloat(row['Standard Cost']) || 0,
        sellingPrice: parseFloat(row['Selling Price']) || 0,
        supplier: row['Supplier'],
        businessId: business.id,
        active: row['Status'] !== 'Out of Stock',
      }
    });
    count++;
  }
  
  console.log(`Successfully recovered ${count} products.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
