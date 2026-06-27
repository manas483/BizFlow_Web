import * as fs from 'fs';
import * as path from 'path';
import { parseInvoicePdfLocally } from '../src/shared/lib/pdf-parser';

const docsDir = 'C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs';

async function main() {
  const pdfs = [
    'Invoice-INV-2026-018_balaram-mohanta_2026-06-19_original.pdf',
    'Invoice-INV-2026-021_san-kanhu-murmu_2026-06-19_original (1).pdf',
    'invoices/GST Invoice - Composite_AGCMBPDC0253.pdf',
    'invoices/GST Invoice - Composite_AGCMBPDF0274.pdf',
    'invoices/GST Invoice - Composite_AGCMBPDSND0126.pdf',
    'invoices/Sales_ASDBPDS0277.pdf',
    'invoices/Sales_ASDBPDS0278.pdf',
    'invoices/Sales_ASDBPDS0397.pdf',
    'invoices/Sales_ASDBPDS0434.pdf'
  ];

  console.log(`Parsing all ${pdfs.length} PDF files...`);

  for (const file of pdfs) {
    const fullPath = path.join(docsDir, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`\n[-] File does not exist: ${file}`);
      continue;
    }

    const buffer = fs.readFileSync(fullPath);
    try {
      const result = await parseInvoicePdfLocally(buffer);
      console.log(`\n[+] PARSED: ${file}`);
      console.log(`  Supplier: ${result.supplier}`);
      console.log(`  Invoice No: ${result.invoiceNumber}`);
      console.log(`  Date: ${result.purchaseDate}`);
      console.log(`  Grand Total: ₹${result.grandTotal}`);
      console.log(`  Items Count: ${result.products.length}`);
      for (const item of result.products) {
        console.log(`    - ${item.name} | Qty: ${item.quantity} | Total: ₹${item.lineTotal}`);
      }
    } catch (err) {
      console.error(`\n[-] Error parsing ${file}:`, err.message);
    }
  }
}

main().catch(console.error);
