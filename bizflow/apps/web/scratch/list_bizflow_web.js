const fs = require('fs');
const path = require('path');

const targetDir = "c:\\Users\\sacha\\Desktop\\BizFlow_Web";

function listDir(dir, depth = 0) {
  if (depth > 3) return;
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) { continue; }
      
      const indent = "  ".repeat(depth);
      if (stat.isDirectory()) {
        if (['node_modules', '.git', '.next', '.turbo'].includes(item)) continue;
        console.log(`${indent}[DIR]  ${item}`);
        listDir(fullPath, depth + 1);
      } else {
        console.log(`${indent}[FILE] ${item} (${(stat.size / 1024).toFixed(2)} KB)`);
      }
    }
  } catch (e) {}
}

async function main() {
  if (!fs.existsSync(targetDir)) {
    console.log(`Directory does not exist: ${targetDir}`);
    return;
  }
  console.log(`Listing files in ${targetDir}:`);
  listDir(targetDir);
}

main().catch(console.error);
