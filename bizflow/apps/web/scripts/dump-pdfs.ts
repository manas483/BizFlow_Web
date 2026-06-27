import PDFParser from 'pdf2json';
import * as fs from 'fs';
import * as path from 'path';

const pdfDir = 'C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\invoices';

function safeDecode(str: string) {
  try { return decodeURIComponent(str); } catch { return str; }
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
          text: safeDecode(t.R[0].T)
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
    
    // Group by Y
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
    
    // Print rows
    rows.forEach((row, idx) => {
      const textLine = row.map(t => t.text).join(' | ');
      if (textLine.includes('1')) {
         console.log(`[ROW] ${textLine}`);
      }
    });
  }
}

main().catch(console.error);
