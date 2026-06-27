const fs = require('fs');
const path = require('path');

const targetDirs = [
  "c:\\Users\\sacha\\Desktop\\BizFlow_Web",
  "c:\\Users\\sacha\\Desktop\\inv"
];

function findEnvFiles(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) { continue; }
      
      if (stat.isDirectory()) {
        if (['node_modules', '.git', '.next', '.turbo'].includes(item)) continue;
        results = results.concat(findEnvFiles(fullPath));
      } else {
        if (item.startsWith('.env')) {
          results.push({ path: fullPath, size: stat.size });
        }
      }
    }
  } catch (e) {}
  return results;
}

async function main() {
  console.log("Searching for .env files in other folders...");
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      console.log(`Directory does not exist: ${dir}`);
      continue;
    }
    console.log(`Scanning: ${dir}`);
    const results = findEnvFiles(dir);
    console.log(`Found ${results.length} .env files:`);
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
      } catch (err) {
        console.log(`  > Error reading file: ${err.message}`);
      }
    }
  }
}

main().catch(console.error);
