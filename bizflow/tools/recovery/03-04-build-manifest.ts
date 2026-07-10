import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config({ path: path.join(__dirname, '../../../.env') });
neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Phase 3 & 4: Match, Score & Build Manifest ===');
  const outDir = path.join(__dirname, 'output');
  
  const orphans = JSON.parse(fs.readFileSync(path.join(outDir, 'orphan_invoices.json'), 'utf8'));
  const extracted = JSON.parse(fs.readFileSync(path.join(outDir, 'extracted_invoices.json'), 'utf8'));
  
  // Load all active products to match against
  const products = await prisma.product.findMany();

  const manifestInvoices = [];
  let totalReady = 0;

  for (const orphan of orphans) {
    const extInv = extracted.find((e: any) => e.invoiceNo === orphan.invoiceNo);
    
    if (!extInv) {
      manifestInvoices.push({
        invoiceNo: orphan.invoiceNo,
        status: 'REJECTED',
        confidence: 0,
        reason: 'Invoice not found in PDF'
      });
      continue;
    }

    let confidence = 100;
    
    // Check Total Match
    if (Math.abs(orphan.total - extInv.total) > 0.1) confidence -= 5;
    if (!extInv.mathValid) confidence -= 10;
    
    const itemsPayload = [];
    
    for (const extItem of extInv.items) {
      // Find Product match
      // First exact name match (case-insensitive)
      let matchedProd = products.find(p => p.name.toLowerCase() === extItem.productName.toLowerCase());
      
      // Try replacing - with space or vice versa if not found
      if (!matchedProd) {
         matchedProd = products.find(p => p.name.replace(/-/g, ' ').toLowerCase() === extItem.productName.replace(/-/g, ' ').toLowerCase());
      }
      
      if (!matchedProd) {
        // Find by fuzzy or fallback to just snapshot
        confidence -= 5; 
      }

      itemsPayload.push({
        saleId: orphan.id,
        productId: matchedProd ? matchedProd.id : "UNKNOWN",
        qty: extItem.qty,
        price: extItem.rate,
        purchasePrice: matchedProd ? matchedProd.standardCost : 0,
        gstRate: extItem.tax > 0 ? ((extItem.tax / extItem.lineTotal) * 100) : 0,
        hsnCode: extItem.hsnCode || (matchedProd ? matchedProd.hsnCode : null),
        discount: extItem.discount,
        productName: extItem.productName, // The snapshot is explicitly saved from PDF
        productSku: matchedProd ? matchedProd.sku : null,
        productUnit: extItem.unit,
        productHsnCode: matchedProd ? matchedProd.hsnCode : null,
        productGstRate: matchedProd ? matchedProd.gstRate : 0,
        productCategory: matchedProd ? matchedProd.category : null,
        originalPrice: matchedProd ? matchedProd.sellingPrice : extItem.rate,
        priceOverrideReason: "Recovery Repair",
        saleQty: extItem.qty,
        saleUnit: extItem.unit,
        isLoose: true, // We don't know packaging, assume loose quantity is correct
        packagingId: null,
        packagingLabel: extItem.unit
      });
    }

    let status = 'REJECTED';
    if (confidence === 100 && !itemsPayload.find(i => i.productId === "UNKNOWN")) {
      status = 'READY';
      totalReady++;
    } else if (confidence >= 99) {
      status = 'MANUAL_REVIEW';
    }

    const payloadString = JSON.stringify(itemsPayload);
    const checksum = crypto.createHash('sha256').update(payloadString).digest('hex').substring(0, 8);

    manifestInvoices.push({
      invoiceNo: orphan.invoiceNo,
      status,
      confidence,
      itemCount: itemsPayload.length,
      checksum,
      items: status === 'REJECTED' ? undefined : itemsPayload
    });
  }

  const manifest = {
    manifestVersion: 1,
    pipelineVersion: "v5",
    timestamp: new Date().toISOString(),
    sourcePdf: "All-Invoices_original_2026-07-01.pdf",
    totalInvoices: orphans.length,
    totalReady,
    invoices: manifestInvoices
  };

  const manifestPath = path.join(outDir, 'repair_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`Manifest built!`);
  console.log(`Total Invoices: ${orphans.length}`);
  console.log(`Ready for Auto-Repair: ${totalReady}`);
  console.log(`Wrote manifest to ${manifestPath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
