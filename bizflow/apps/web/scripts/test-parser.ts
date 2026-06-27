import PDFParser from 'pdf2json';
import * as fs from 'fs';
import * as path from 'path';

const pdfDir = 'C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\invoices';

function safeDecode(str: string) {
  try { return decodeURIComponent(str); } catch { return str; }
}

function parseNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[^0-9.\-]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

async function parseFile(file: string) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, false);
    parser.on("pdfParser_dataError", errData => reject(errData.parserError));
    parser.on("pdfParser_dataReady", pdfData => {
      const page = pdfData.Pages[0];
      const texts = [];
      for (const t of page.Texts) {
        texts.push({
          x: t.x,
          y: t.y,
          text: safeDecode(t.R[0].T).trim()
        });
      }
      resolve(texts);
    });
    parser.loadPDF(path.join(pdfDir, file));
  });
}

async function main() {
  const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
  for (const file of files) {
    console.log(`\n\n=== FILE: ${file} ===`);
    const texts: any = await parseFile(file);
    const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
    
    const rows = [];
    let currentRow = [];
    let currentY = sorted[0].y;
    
    for (const t of sorted) {
      if (Math.abs(t.y - currentY) > 0.5) {
        if (currentRow.length > 0) rows.push(currentRow);
        currentRow = [];
        currentY = t.y;
      }
      currentRow.push(t);
    }
    if (currentRow.length > 0) rows.push(currentRow);
    
    for (const row of rows) {
      const textsInRow = row.map(t => t.text);
      
      // Look for HSN
      const hsnText = textsInRow.find(t => /^\d{4,8}$/.test(t) && t !== '2026' && t.length >= 4);
      
      // Look for Quantity
      const qtyRegex = /^(\d+)\s*(Nos|bags|pcs|kg|gm|ltr|ml|box|pack|pkt)s?$/i;
      const qtyText = textsInRow.find(t => qtyRegex.test(t));
      
      // Look for Numbers (Rate, Amount)
      const numberTexts = textsInRow.filter(t => /^[\d,]+\.\d{2}$/.test(t));
      const numbers = numberTexts.map(parseNumber).sort((a, b) => a - b);
      
      if (hsnText && (qtyText || numbers.length >= 2)) {
        let quantity = 0;
        let unit = 'pcs';
        if (qtyText) {
            const match = qtyText.match(qtyRegex);
            quantity = parseInt(match[1]);
            unit = match[2];
        }
        
        let amount = numbers.length > 0 ? numbers[numbers.length - 1] : 0;
        let rateIncl = numbers.length > 1 ? numbers[numbers.length - 2] : amount;
        let rateTaxable = numbers.length > 2 ? numbers[0] : rateIncl;

        // If no qtyText, maybe infer from amount / rate
        if (quantity === 0 && amount > 0 && rateIncl > 0) {
           quantity = Math.round(amount / rateIncl);
        }

        // Description is the rest
        const descTexts = textsInRow.filter(t => 
            t !== hsnText && 
            t !== qtyText && 
            !numberTexts.includes(t) && 
            !/^\d+$/.test(t) &&
            !/^(Nos|bags|pcs|kg|gm|ltr|ml|box|pack|pkt)$/i.test(t)
        );
        let description = descTexts.join(' ');

        console.log(`[Extracted] Qty: ${quantity} ${unit} | Rate: ${rateIncl} | Amt: ${amount} | HSN: ${hsnText} | Desc: ${description}`);
      }
    }
  }
}

main().catch(console.error);
