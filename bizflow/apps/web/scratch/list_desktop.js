const fs = require('fs');
const path = require('path');

const desktopDir = "c:\\Users\\sacha\\Desktop";

async function main() {
  try {
    const list = fs.readdirSync(desktopDir);
    console.log(`Contents of ${desktopDir}:`);
    for (const item of list) {
      const fullPath = path.join(desktopDir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        console.log(`[DIR]  ${item}`);
      } else {
        console.log(`[FILE] ${item} (${(stat.size / 1024).toFixed(2)} KB)`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

main().catch(console.error);
