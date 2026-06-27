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

export async function parsePdfToText(filePath: string): Promise<any[]> {
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
    parser.loadPDF(filePath);
  });
}

function extractHeader(texts: any[]) {
    let supplierGstin = '';
    let invoiceNumber = '';
    let purchaseDate = '';
    let supplier = '';
    
    const fullText = texts.map(t => t.text).join(' ');
    
    // Extract GSTIN
    const gstinMatch = fullText.match(/GSTIN(?:\/UIN)?:\s*([A-Z0-9]{15})/i);
    if (gstinMatch) supplierGstin = gstinMatch[1];
    
    // Extract Invoice No
    // Looking for AGCMBP... or ASDBP... or AGR-SLP...
    const invMatch = fullText.match(/\b(AGCMBP[A-Z0-9]+|ASDBP[A-Z0-9]+|AGR-SLP-[A-Z0-9-]+)\b/i);
    if (invMatch) invoiceNumber = invMatch[1];
    
    // Extract Date (dd-Mmm-yy)
    const dateMatch = fullText.match(/\b(\d{1,2}-[A-Za-z]{3}-\d{2,4})\b/);
    if (dateMatch) purchaseDate = dateMatch[1];
    
    // Supplier is usually the first big text element or just fallback
    supplier = "Unknown Supplier";
    
    return { supplierGstin, invoiceNumber, purchaseDate, supplier };
}

function extractProducts(texts: any[]) {
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
    
    const products = [];
    
    // Find the Y coordinate of the "Total" row to stop parsing products
    let tableEndY = 999;
    for (const row of rows) {
        const textStr = row.map(t => t.text.toLowerCase()).join(' ');
        if (textStr.includes('total') || textStr.includes('rounded')) {
            tableEndY = row[0].y - 0.5; // stop slightly before
            break;
        }
    }

    for (const row of rows) {
      if (row[0].y > tableEndY) continue; // Skip GST summary rows

      const textsInRow = row.map(t => t.text);
      
      const hsnText = textsInRow.find(t => /^\d{4,8}$/.test(t) && t !== '2026' && t.length >= 4);
      const qtyRegex = /^(\d+)\s*(Nos|bags|pcs|kg|gm|ltr|ml|box|pack|pkt)s?$/i;
      const qtyText = textsInRow.find(t => qtyRegex.test(t));
      
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

        if (quantity === 0 && amount > 0 && rateIncl > 0) {
           quantity = Math.round(amount / rateIncl);
        }

        const descTexts = textsInRow.filter(t => 
            t !== hsnText && 
            t !== qtyText && 
            !numberTexts.includes(t) && 
            !/^\d+$/.test(t) &&
            !/^(Nos|bags|pcs|kg|gm|ltr|ml|box|pack|pkt)$/i.test(t) &&
            !/^\d+\s*$/.test(t) // filter isolated numbers like sl no
        );
        let description = descTexts.join(' ').replace(/\|/g, '').trim();

        products.push({
            name: description,
            hsnCode: hsnText,
            quantity,
            unit,
            purchasePrice: rateIncl,
            basePurchasePrice: rateTaxable,
            lineTotal: amount
        });
      }
    }
    
    return products;
}

async function main() {
  const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
  for (const file of files) {
    console.log(`\n=== FILE: ${file} ===`);
    const texts = await parsePdfToText(path.join(pdfDir, file));
    
    const header = extractHeader(texts);
    console.log(`HEADER: Invoice=${header.invoiceNumber}, Date=${header.purchaseDate}, GSTIN=${header.supplierGstin}`);
    
    const products = extractProducts(texts);
    for (const p of products) {
        console.log(`  -> ${p.quantity} ${p.unit} of "${p.name}" | HSN: ${p.hsnCode} | Amt: ${p.lineTotal}`);
    }
  }
}

main().catch(console.error);
