const fs = require('fs');
const path = require('path');

const configDir = "C:\\Users\\sacha\\.config\\neonctl";

async function main() {
  if (!fs.existsSync(configDir)) {
    console.log("Config directory does not exist.");
    return;
  }
  
  const files = fs.readdirSync(configDir);
  console.log(`Files in ${configDir}:`, files);
  
  for (const file of files) {
    const fullPath = path.join(configDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      console.log(`\n=== File: ${file} ===`);
      const content = fs.readFileSync(fullPath, 'utf8');
      if (file.includes('key') || file.includes('credentials') || file.includes('token')) {
        console.log(content.substring(0, 30) + "... [Redacted for safety]");
      } else {
        console.log(content);
      }
    }
  }
}

main().catch(console.error);
