import * as fs from 'fs';
import * as path from 'path';
import { parseInvoicePdfLocally } from './src/shared/lib/pdf-parser';

const pdfDir = 'C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\invoices';

async function main() {
  const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
  console.log(`Found ${files.length} invoice PDFs. Parsing...`);

  for (const file of files) {
    console.log(`\n========================================`);
    console.log(`FILE: ${file}`);
    const buffer = fs.readFileSync(path.join(pdfDir, file));
    try {
      const result = await parseInvoicePdfLocally(buffer, "cmqjr5kp2000004l458cjomrn");
      console.log(`Supplier: ${result.supplier}`);
      console.log(`GSTIN: ${result.supplierGstin}`);
      console.log(`Invoice No: ${result.invoiceNumber}`);
      console.log(`Purchase Date: ${result.purchaseDate}`);
      console.log(`Grand Total: ${result.grandTotal}`);
      console.log(`Products: ${result.products?.length ?? 0}`);
      if (result.products) {
        for (const p of result.products) {
          console.log(`  - ${p.name} (${p.sku}) | Qty: ${p.quantity} | Base Cost: ${p.basePurchasePrice} | Total Cost: ${p.purchasePrice} | GST: ${p.gstRate}% | Line Total: ${p.lineTotal}`);
        }
      }
    } catch (err: any) {
      console.error(`Error parsing ${file}:`, err.message);
    }
  }
}

main().catch(console.error);
