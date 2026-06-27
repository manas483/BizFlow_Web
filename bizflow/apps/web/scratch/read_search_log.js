const fs = require('fs');

const logPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\3f9cf458-4c06-4fd3-bca8-1fc37b353294\\.system_generated\\tasks\\task-749.log";

async function main() {
  if (!fs.existsSync(logPath)) {
    console.log(`Log file does not exist: ${logPath}`);
    return;
  }
  
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  
  console.log("=== Matching lines in full search log ===");
  for (const line of lines) {
    if (line.includes('c:\\Users\\sacha\\Desktop') && !line.includes('node_modules') && !line.includes('flutter_secure_storage') && !line.includes('cloud_firestore')) {
      console.log(line.trim());
    }
  }
}

main().catch(console.error);
