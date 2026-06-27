const fs = require('fs');
const xlsx = require('xlsx');

async function main() {
  const filePath = "c:\\Users\\sacha\\Desktop\\B\\bizflow\\docs\\Fertiliser pesticides register format (1).xlsx";
  if (!fs.existsSync(filePath)) {
    console.log(`Excel file does not exist: ${filePath}`);
    return;
  }

  try {
    const workbook = xlsx.readFile(filePath);
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      
      console.log(`\nSheet: ${sheetName}`);
      const nonValuedRows = [];
      data.forEach((row, idx) => {
        const hasValues = row.some(cell => cell !== null && cell !== undefined && cell !== '');
        if (hasValues) {
          nonValuedRows.push({ index: idx, content: row });
        }
      });
      
      console.log(`Total non-empty rows: ${nonValuedRows.length}`);
      console.log("Non-empty Rows:");
      console.log(nonValuedRows.slice(0, 30));
    }
  } catch (err) {
    console.error("Error reading xlsx:", err.message);
  }
}

main().catch(console.error);
