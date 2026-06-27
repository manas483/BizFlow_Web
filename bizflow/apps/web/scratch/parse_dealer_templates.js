const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const files = [
  "c:\\Users\\sacha\\Downloads\\BizFlow_Fertilizer_Dealer_Inventory_Template (2).xlsx",
  "c:\\Users\\sacha\\Downloads\\BizFlow_Fertilizer_Dealer_Inventory_Template (1).xlsx",
  "c:\\Users\\sacha\\Downloads\\BizFlow_Fertilizer_Dealer_Inventory_Template.xlsx",
  "c:\\Users\\sacha\\Downloads\\BizFlow_Kirana_Store_Inventory_Template.xlsx"
];

async function main() {
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.log(`File does not exist: ${filePath}`);
      continue;
    }

    console.log(`\n========================================`);
    console.log(`PARSING: ${filePath}`);
    console.log(`========================================`);

    try {
      const workbook = xlsx.readFile(filePath);
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        const nonValuedRows = [];
        data.forEach((row, idx) => {
          const hasValues = row.some(cell => cell !== null && cell !== undefined && cell !== '');
          if (hasValues) {
            nonValuedRows.push({ index: idx, content: row });
          }
        });
        
        console.log(`Sheet: ${sheetName} | Total rows: ${data.length} | Non-empty rows: ${nonValuedRows.length}`);
        if (nonValuedRows.length > 0) {
          console.log("Sample Rows:");
          console.log(nonValuedRows.slice(0, 15));
        }
      }
    } catch (err) {
      console.error("Error reading file:", err.message);
    }
  }
}

main().catch(console.error);
