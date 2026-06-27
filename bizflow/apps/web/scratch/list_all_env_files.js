const fs = require('fs');
const path = require('path');

const rootDir = "c:\\Users\\sacha\\Desktop\\B";

function scan(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }
      
      if (stat.isDirectory()) {
        results = results.concat(scan(fullPath));
      } else {
        if (item.toLowerCase().includes('.env')) {
          results.push({ path: fullPath, size: stat.size });
        }
      }
    }
  } catch (err) {}
  return results;
}

async function main() {
  console.log(`Scanning all files in ${rootDir} containing '.env' in their name...`);
  const results = scan(rootDir);
  console.log(`Found ${results.length} files:`);
  for (const r of results) {
    console.log(`- ${r.path} (${r.size} bytes)`);
    try {
      const content = fs.readFileSync(r.path, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes('DATABASE_URL')) {
          console.log(`  > ${line.trim()}`);
        }
      }
    } catch (e) {
      console.log(`  > Error reading: ${e.message}`);
    }
  }
}

main().catch(console.error);
