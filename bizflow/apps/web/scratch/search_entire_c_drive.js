const fs = require('fs');
const path = require('path');

const userDir = "C:\\Users\\sacha";
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
        // Skip system directories and caches
        const lowerName = file.toLowerCase();
        if (
          lowerName === 'node_modules' || lowerName === '.git' || lowerName === '.next' ||
          lowerName === 'appdata' || lowerName === 'microsoft' || lowerName === '.gemini' ||
          lowerName === '.vscode' || lowerName === 'cache' || lowerName === 'temp'
        ) {
          continue;
        }
        search(fullPath);
      } else {
        const ext = path.extname(file).toLowerCase();
        const name = file.toLowerCase();
        
        if (ext === '.pdf' && (name.includes('invoice') || name.includes('inv-') || name.includes('sales_'))) {
          foundFiles.push({ path: fullPath, size: stat.size, mtime: stat.mtime });
        }
      }
    }
  } catch (err) {}
}

async function main() {
  console.log(`Starting recursive search in ${userDir}...`);
  search(userDir);
  console.log(`Search complete. Found ${foundFiles.length} matching PDF invoices.`);
  
  // Sort by modified time descending
  foundFiles.sort((a, b) => b.mtime - a.mtime);
  
  for (const f of foundFiles) {
    console.log(`- ${f.path} (Modified: ${f.mtime.toISOString()}, Size: ${(f.size / 1024).toFixed(1)} KB)`);
  }
}

main().catch(console.error);
