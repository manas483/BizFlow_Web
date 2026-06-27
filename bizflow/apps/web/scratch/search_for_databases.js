const fs = require('fs');
const path = require('path');

const searchDirs = [
  "c:\\Users\\sacha\\Desktop\\B",
  "C:\\Users\\sacha\\.gemini\\antigravity-ide",
  "C:\\Users\\sacha\\Downloads"
];

const targetExtensions = ['.db', '.sqlite', '.sqlite3', '.sql', '.dump', '.backup'];

function search(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }
      
      if (stat.isDirectory()) {
        // Skip node_modules, .git, .next, .turbo
        if (['node_modules', '.git', '.next', '.turbo', 'playwright-report', 'test-results'].includes(file)) {
          continue;
        }
        results = results.concat(search(fullPath));
      } else {
        const ext = path.extname(file).toLowerCase();
        if (targetExtensions.includes(ext) || file.toLowerCase().includes('backup') || file.toLowerCase().includes('restore') || file.toLowerCase().includes('dump')) {
          results.push({ path: fullPath, size: stat.size });
        }
      }
    }
  } catch (err) {
    // Ignore unreadable dirs
  }
  return results;
}

async function main() {
  console.log("Searching for database files in specified folders...");
  const allResults = [];
  for (const dir of searchDirs) {
    console.log(`Searching in: ${dir}`);
    const results = search(dir);
    allResults.push(...results);
  }
  
  console.log(`\nFound ${allResults.length} matching files:`);
  for (const r of allResults) {
    console.log(`- ${r.path} (${(r.size / 1024).toFixed(2)} KB)`);
  }
}

main().catch(console.error);
