const { execSync } = require('child_process');

async function main() {
  try {
    console.log("=== LAST 50 COMMITS IN REPOSITORY ===");
    const output = execSync('git log -n 50 --pretty=format:"%h - %an, %ad : %s" --date=short', { encoding: 'utf8' });
    console.log(output);
  } catch (err) {
    console.error("Error running git log:", err.message);
  }
}

main().catch(console.error);
