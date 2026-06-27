const { execSync } = require('child_process');
const path = require('path');

const paths = {
  'web': "c:\\Users\\sacha\\Desktop\\B\\bizflow\\apps\\web",
  'root': "c:\\Users\\sacha\\Desktop\\B\\bizflow"
};

async function main() {
  for (const [name, dir] of Object.entries(paths)) {
    console.log(`\n========================================`);
    console.log(`VERCEL ENV FOR DIR: ${dir} (${name})`);
    console.log(`========================================`);
    try {
      const output = execSync(`npx vercel env ls`, { cwd: dir, encoding: 'utf8' });
      console.log(output);
    } catch (err) {
      console.error(`Error fetching env for ${name}:`, err.message);
    }
  }
}

main().catch(console.error);
