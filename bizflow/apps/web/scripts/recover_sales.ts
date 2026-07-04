import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as fs from 'fs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const business = await prisma.business.findFirst({
    where: { name: 'BizFlow' }
  });
  if (!business) throw new Error("Business not found");

  const text = fs.readFileSync('c:\\\\Users\\\\sacha\\\\Desktop\\\\B\\\\bizflow\\\\apps\\\\web\\\\scratch\\\\pdf_text.txt', 'utf8');
  const pages = text.split('----------------Page (');

  let salesCount = 0;

  for (const page of pages) {
    if (!page.trim()) continue;

    // Extract Invoice Number
    const invMatch = page.match(/(INV-[-\d]+)/);
    if (!invMatch) {
      console.log('Skipped page: No invoice match found');
      continue;
    }
    const invoiceNumber = invMatch[1];

    // Extract Date
    const dateMatch = page.match(/(\d{2}-[A-Za-z]{3}-\d{2})/);
    let date = new Date();
    if (dateMatch) {
      date = new Date(dateMatch[1]);
    }

    // Extract Grand Total
    const totalMatch = page.match(/Total\s+([\d.]+)\s+0\.00\s+0\.00\s+Rs\. 0\.00/);
    let grandTotal = 0;
    if (totalMatch) {
      grandTotal = parseFloat(totalMatch[1]);
    }

    // Try to find customer name
    let customerName = "Walk-in Customer";
    const nameMatch = page.match(/Code\s*:\s*21([\s\S]+?)Buyer's Order No\./);
    if (nameMatch) {
       customerName = nameMatch[1].trim().split(/\r?\n/).pop()?.trim() || "Walk-in Customer";
    }
    if (customerName === 'A' || customerName.length < 3) customerName = "Walk-in Customer";

    // Extract items
    const items = [];
    const itemRegex = /^\d+\s+(.*?)\s+(\d{6,8})\s+(\d+)\s+(pcs|bags|kg)\s+([\d.]+)\s+[\d.]+\s+[\d.]+\s+([\d.]+)/gm;
    let match;
    while ((match = itemRegex.exec(page)) !== null) {
      items.push({
        name: match[1].trim(),
        quantity: parseInt(match[3], 10),
        price: parseFloat(match[5]),
        total: parseFloat(match[6])
      });
    }
    
    if (items.length === 0) {
       console.log(`Skipped ${invoiceNumber}: No items parsed (Check regex)`);
       continue;
    }

    // Create Customer
    let customer = await prisma.customer.findFirst({
      where: { name: customerName, businessId: business.id }
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { name: customerName, businessId: business.id, phone: '0000000000' }
      });
    }

    // Resolve products for items
    const resolvedItems = [];
    for (const item of items) {
      const sku = item.name.substring(0, 10).toUpperCase().replace(/\s/g, '');
      let product = await prisma.product.findFirst({
        where: { name: item.name, businessId: business.id }
      });
      if (!product) {
        product = await prisma.product.create({
          data: {
            name: item.name,
            sku,
            businessId: business.id,
            sellingPrice: item.price,
            active: true
          }
        });
      }
      resolvedItems.push({
        qty: item.quantity,
        price: item.price,
        productId: product.id
      });
    }

    // Create Sale
    const existingSale = await prisma.sale.findFirst({
      where: { invoiceNo: invoiceNumber, businessId: business.id }
    });
    if (existingSale) {
      console.log(`Skipped ${invoiceNumber}: Already exists`);
      continue;
    }

    const sale = await prisma.sale.create({
      data: {
        invoiceNo: invoiceNumber,
        invoiceDate: date,
        total: grandTotal || items.reduce((sum, i) => sum + i.total, 0),
        status: 'paid',
        paid: grandTotal || items.reduce((sum, i) => sum + i.total, 0),
        customerId: customer.id,
        businessId: business.id,
        items: {
          create: resolvedItems.map(item => ({
            qty: item.qty,
            price: item.price,
            product: {
              connect: { id: item.productId }
            }
          }))
        }
      }
    });
    console.log(`Created sale ${invoiceNumber} for ${customerName} with ${items.length} items`);
    salesCount++;
  }
  
  console.log(`Recovered ${salesCount} sales!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
