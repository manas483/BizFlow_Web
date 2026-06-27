const fs = require('fs');
const path = require('path');

const targetId = "3c049a48-799d-4fbf-9470-4b9bee7215a5";
const brainDir = `C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\${targetId}`;

async function main() {
  if (!fs.existsSync(brainDir)) {
    console.log(`Brain directory does not exist: ${brainDir}`);
    return;
  }
  
  console.log(`Brain directory exists: ${brainDir}`);
  const logsDir = path.join(brainDir, '.system_generated', 'logs');
  if (fs.existsSync(logsDir)) {
    console.log(`Logs directory exists: ${logsDir}`);
    const files = fs.readdirSync(logsDir);
    console.log("Files:", files);
  } else {
    console.log(`Logs directory does not exist: ${logsDir}`);
  }
}

main().catch(console.error);
