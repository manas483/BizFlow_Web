const fs = require('fs');

const p = "c:\\Users\\sacha\\Desktop\\Tax Invoice\\B\\bizflow\\apps\\web\\.env";

async function main() {
  if (fs.existsSync(p)) {
    console.log(`\nFound env file at: ${p}`);
    const content = fs.readFileSync(p, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes('DATABASE_URL')) {
        console.log(`  DATABASE_URL: ${line.trim()}`);
      }
    }
  } else {
    console.log(`Not found: ${p}`);
  }
}

main().catch(console.error);
