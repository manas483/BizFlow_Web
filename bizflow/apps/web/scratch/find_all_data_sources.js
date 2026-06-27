const fs = require('fs');
const path = require('path');

const searchPaths = [
  "c:\\Users\\sacha\\Desktop\\B\\bizflow",
  "c:\\Users\\sacha\\Desktop"
];

const foundFiles = [];

function search(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }
      
      if (stat.isDirectory()) {
        // Skip node_modules, .git, .next, etc.
        if (file === 'node_modules' || file === '.git' || file === '.next' || file === '.agents' || file === '.gemini') {
          continue;
        }
        search(fullPath);
      } else {
        const ext = path.extname(file).toLowerCase();
        const name = file.toLowerCase();
        
        if (
          ext === '.xlsx' || ext === '.xls' || ext === '.csv' || ext === '.sql' || ext === '.sqlite' || ext === '.db' ||
          (ext === '.pdf' && (name.includes('invoice') || name.includes('inv-') || name.includes('sales'))) ||
          name.includes('backup') || name.includes('restore') || name.includes('dump')
        ) {
          foundFiles.push({ path: fullPath, size: stat.size });
        }
      }
    }
  } catch (err) {}
}

async function main() {
  console.log("Searching for data files in Desktop and workspace...");
  for (const p of searchPaths) {
    search(p);
  }
  
  console.log(`\nFound ${foundFiles.length} potential data source files:`);
  for (const f of foundFiles) {
    console.log(`- ${f.path} (${(f.size / 1024).toFixed(1)} KB)`);
  }
}

main().catch(console.error);
