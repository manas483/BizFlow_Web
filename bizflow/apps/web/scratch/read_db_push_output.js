const fs = require('fs');

const logPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\3c049a48-799d-4fbf-9470-4b9bee7215a5\\.system_generated\\tasks\\task-517.log";

async function main() {
  if (!fs.existsSync(logPath)) {
    console.log(`Log file does not exist: ${logPath}`);
    return;
  }
  
  const content = fs.readFileSync(logPath, 'utf8');
  console.log("=== DB PUSH TASK LOG CONTENT ===");
  console.log(content);
}

main().catch(console.error);
