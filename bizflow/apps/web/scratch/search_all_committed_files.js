const { execSync } = require('child_process');

async function main() {
  try {
    console.log("Listing all unique files in the entire git repository history...");
    const output = execSync('git log --all --name-only --format=""', { encoding: 'utf8' });
    const files = output.split('\n').map(f => f.trim()).filter(Boolean);
    const uniqueFiles = [...new Set(files)];
    
    console.log(`\nFound ${uniqueFiles.length} unique files in history.`);
    
    const targetExtensions = ['.json', '.csv', '.sql', '.xlsx', '.sqlite', '.db'];
    
    console.log("\n=== MATCHING DATA FILES IN GIT HISTORY ===");
    for (const file of uniqueFiles) {
      const ext = require('path').extname(file).toLowerCase();
      if (targetExtensions.includes(ext) || file.toLowerCase().includes('backup') || file.toLowerCase().includes('restore') || file.toLowerCase().includes('dump')) {
        console.log(`- ${file}`);
      }
    }
  } catch (err) {
    console.error("Error running git log:", err.message);
  }
}

main().catch(console.error);
