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
    const ext = path.extname(file).toLowerCase();

    if (
      name.includes('bizflow') || name.includes('backup') || name.includes('export') || name.includes('invoice') ||
      ext === '.xlsx' || ext === '.xls' || ext === '.csv' || ext === '.json'
    ) {
      found.push({ name: file, size: stat.size, mtime: stat.mtime });
    }
  }

  // Sort by modification time descending
  found.sort((a, b) => b.mtime - a.mtime);

  console.log(`\n=== MATCHING DOWNLOADED FILES ===`);
  for (const f of found.slice(0, 50)) {
    console.log(`- Name: ${f.name}`);
    console.log(`  Size: ${(f.size / 1024).toFixed(1)} KB`);
    console.log(`  Modified: ${f.mtime.toISOString()}`);
  }
  if (found.length > 50) {
    console.log(`... and ${found.length - 50} more matching files.`);
  }
}

main().catch(console.error);
