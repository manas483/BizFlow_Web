const fs = require('fs');
const path = require('path');

const brainDir = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain";

async function main() {
  if (!fs.existsSync(brainDir)) {
    console.log(`Brain directory does not exist: ${brainDir}`);
    return;
  }

  const dirs = fs.readdirSync(brainDir).filter(f => {
    const fullPath = path.join(brainDir, f);
    return fs.statSync(fullPath).isDirectory();
  });

  console.log("=== ALL CONVERSATION DIRECTORIES IN BRAIN ===");
  for (const d of dirs) {
    const fullPath = path.join(brainDir, d);
    const stat = fs.statSync(fullPath);
    console.log(`- ID: ${d} | Created: ${stat.birthtime.toISOString()} | Modified: ${stat.mtime.toISOString()}`);
  }
}

main().catch(console.error);
