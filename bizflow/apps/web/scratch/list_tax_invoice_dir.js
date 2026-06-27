const fs = require('fs');
const path = require('path');

const targetDir = "c:\\Users\\sacha\\Desktop\\Tax Invoice";

async function main() {
  if (!fs.existsSync(targetDir)) {
    console.log(`Directory does not exist: ${targetDir}`);
    return;
  }
  
  const files = fs.readdirSync(targetDir);
  console.log(`Files in ${targetDir}:`, files.slice(0, 50));
  if (files.length > 50) {
    console.log(`... and ${files.length - 50} more files.`);
  }
}

main().catch(console.error);
