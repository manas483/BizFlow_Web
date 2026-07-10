import fs from 'fs';
import pdf from 'pdf-parse';
import path from 'path';

async function main() {
  const pdfPath = 'c:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\All-Invoices_original_2026-07-01.pdf';
  const dataBuffer = fs.readFileSync(pdfPath);

  const data = await pdf(dataBuffer, {
    max: 2 // only first 2 pages to understand the structure
  });

  const outPath = path.join(__dirname, 'output', 'pdf-sample.txt');
  fs.writeFileSync(outPath, data.text);
  console.log('Sample text written to', outPath);
}

main().catch(console.error);
