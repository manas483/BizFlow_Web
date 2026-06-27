const fs = require('fs');
const path = require('path');

const downloadsDir = "c:\\Users\\sacha\\Downloads";

async function main() {
  if (!fs.existsSync(downloadsDir)) {
    console.log(`Downloads directory does not exist: ${downloadsDir}`);
    return;
  }

  const files = fs.readdirSync(downloadsDir);
  console.log(`Scanning ${files.length} files in Downloads...`);

  const found = [];
  const searchTerms = ['register', 'seeds', 'fertilizer', 'pesticide', 'sale', 'stock', 'customer'];
  
  for (const file of files) {
    const fullPath = path.join(downloadsDir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }

    if (stat.isDirectory()) continue;

    const name = file.toLowerCase();
    
    if (searchTerms.some(term => name.includes(term))) {
      found.push({ name: file, size: stat.size, mtime: stat.mtime });
    }
  }

  // Sort by modification time descending
  found.sort((a, b) => b.mtime - a.mtime);

  console.log(`\n=== MATCHING DOWNLOADED FILES ===`);
  for (const f of found) {
    console.log(`- ${f.name} (${(f.size / 1024).toFixed(1)} KB) - Modified: ${f.mtime.toISOString()}`);
  }
}

main().catch(console.error);
