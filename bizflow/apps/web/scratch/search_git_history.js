const { execSync } = require('child_process');

async function main() {
  console.log("Scanning full git history for postgres/postgresql connection strings...");
  try {
    const output = execSync('git log -p --all --reflog', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const regex = /(postgres(?:ql)?:\/\/[^\s"'`]+)/g;
    const matches = new Set();
    
    let match;
    while ((match = regex.exec(output)) !== null) {
      matches.add(match[1]);
    }
    
    console.log(`\nFound ${matches.size} unique database URL strings in git history:\n`);
    for (const url of matches) {
      console.log(url);
    }
  } catch (err) {
    console.error("Error executing git command:", err.message);
  }
}

main();
