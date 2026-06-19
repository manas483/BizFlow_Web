const fs = require('fs');
const { execSync } = require('child_process');

const envFile = fs.readFileSync('.env', 'utf8');
const lines = envFile.split('\n');

for (const line of lines) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue;
  const splitIdx = line.indexOf('=');
  const key = line.substring(0, splitIdx).trim();
  let value = line.substring(splitIdx + 1).trim();
  
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.substring(1, value.length - 1);
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.substring(1, value.length - 1);
  }

  console.log(`Adding ${key}...`);
  try {
    // Vercel env add reads from stdin
    execSync(`npx vercel env add ${key} production`, { input: value, stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`Success: ${key}`);
  } catch (err) {
    console.error(`Failed to add ${key}:`, err.message);
  }
}
