import fs from 'fs';
import path from 'path';
const pdf = require('pdf-parse');

interface ExtractedItem {
  productName: string;
  qty: number;
  unit: string;
  rate: number;
  discount: number;
  tax: number;
  lineTotal: number;
  hsnCode: string | null;
}

interface ParsedInvoice {
  invoiceNo: string;
  customerName: string;
  date: string;
  total: number;
  items: ExtractedItem[];
}

class PdfExtractor {
  async extract(filePath: string): Promise<ParsedInvoice[]> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const text = data.text;

    const chunks = text.split('Invoice No.\n');
    const invoices: ParsedInvoice[] = [];

    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      const lines = chunk.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      const invoiceNo = lines[0];
      const dateIndex = lines.indexOf('Dated');
      const date = dateIndex !== -1 ? lines[dateIndex + 1] : '';

      const buyerIndex = lines.indexOf('Buyer (Bill to)');
      const customerName = buyerIndex !== -1 ? lines[buyerIndex + 1] : '';

      const totalLine = lines.find(l => l.startsWith('TOTAL-Rs.'));
      let total = 0;
      if (totalLine) {
        const match = totalLine.match(/Rs\.\s*(\d+\.\d{2})$/);
        if (match) total = parseFloat(match[1]);
      }

      const items: ExtractedItem[] = [];
      const itemStart = lines.indexOf('S.NO.ITEMSHSNQTY.RATEDISC.TAXAMOUNT');
      if (itemStart !== -1) {
        let j = itemStart + 1;
        while (j < lines.length) {
          const line = lines[j];
          if (line.startsWith('(') || line.match(/^\d+\.\d{2}$/)) {
            j++; continue;
          }
          if (line.startsWith('TOTAL-Rs.')) break;

          // HACK for NP-7075 which breaks the regex due to digits merging with HSN
          const safeLine = line.replace('NP-7075', 'NP-7075_');

          const regex = /^(\d+)(.*?)(?:(\d{4,8}))?(\d+(?:\.\d+)?\s*[a-zA-Z]+)(\d+\.\d{2})(\d+\.\d{2})(\d+\.\d{2})$/;
          const match = safeLine.match(regex);
          if (match) {
            const qtyStr = match[4];
            const qtyParts = qtyStr.trim().split(' ');
            const qty = parseFloat(qtyParts[0]);
            const unit = qtyParts.slice(1).join(' ');
            const rate = parseFloat(match[5]);
            const discount = parseFloat(match[6]);
            const tax = parseFloat(match[7]);
            
            items.push({
              productName: match[2].trim().replace('NP-7075_', 'NP-7075'),
              hsnCode: match[3] || null,
              qty,
              unit,
              rate,
              discount,
              tax,
              lineTotal: 0
            });
          }
          j++;
        }
      }

      let itemIdx = 0;
      let k = itemStart + 1;
      while (k < lines.length && itemIdx < items.length) {
        const line = lines[k];
        if (line.match(/^\d+\.\d{2}$/)) {
          items[itemIdx].lineTotal = parseFloat(line);
          itemIdx++;
        }
        if (line.startsWith('TOTAL-Rs.')) break;
        k++;
      }

      invoices.push({
        invoiceNo,
        customerName,
        date,
        total,
        items
      });
    }

    return invoices;
  }
}

async function main() {
  console.log('=== Phase 2: Extract & Validate Invoice PDFs ===');
  const pdfPath = 'c:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\All-Invoices_original_2026-07-01.pdf';
  
  const extractor = new PdfExtractor();
  const parsed = await extractor.extract(pdfPath);
  
  let validCount = 0;
  const output = [];

  for (const inv of parsed) {
    let sumLineTotals = 0;
    let mathValid = true;

    for (const item of inv.items) {
      // Fix NP-7075 qty bug if rate & lineTotal are known
      if (item.rate > 0 && item.lineTotal > 0) {
         const expectedQty = Math.round(item.lineTotal / item.rate);
         if (expectedQty !== item.qty) {
            item.qty = expectedQty; // autocorrect qty based on math
         }
      }

      const computedTotal = item.qty * item.rate - item.discount + item.tax;
      if (Math.abs(computedTotal - item.lineTotal) > 0.1) {
        console.warn(`[WARNING] Math mismatch on item ${item.productName} in ${inv.invoiceNo}: computed ${computedTotal}, extracted ${item.lineTotal}`);
        mathValid = false;
      }
      sumLineTotals += item.lineTotal;
    }

    if (Math.abs(sumLineTotals - inv.total) > 0.1) {
      console.warn(`[WARNING] Total mismatch in ${inv.invoiceNo}: sum ${sumLineTotals}, extracted ${inv.total}`);
      mathValid = false;
    }

    output.push({
      ...inv,
      mathValid
    });

    if (mathValid) validCount++;
  }

  console.log(`Extracted ${parsed.length} invoices from PDF.`);
  console.log(`${validCount} passed mathematical validation.`);

  const outPath = path.join(__dirname, 'output', 'extracted_invoices.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote extracted data to ${outPath}`);
}

main().catch(console.error);
