import * as fs from 'fs';
import * as path from 'path';
import { parseInvoicePdfLocally } from '../src/shared/lib/pdf-parser';

const docsDir = 'C:\\Users\\sacha\\Desktop\\B\\bizflow\\docs';

async function main() {
  const files = [
    'Invoice-INV-2026-018_balaram-mohanta_2026-06-19_original.pdf',
    'Invoice-INV-2026-021_san-kanhu-murmu_2026-06-19_original (1).pdf'
  ];

  for (const file of files) {
    console.log(`\n========================================`);
    console.log(`PARSING: ${file}`);
    console.log(`========================================`);
    const fullPath = path.join(docsDir, file);
    if (!fs.existsSync(fullPath)) {
      console.log("File does not exist:", fullPath);
      continue;
    }

    const buffer = fs.readFileSync(fullPath);
    try {
      const result = await parseInvoicePdfLocally(buffer);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error("Error parsing:", err.message);
    }
  }
}

main().catch(console.error);
