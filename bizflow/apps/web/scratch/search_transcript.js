const fs = require('fs');
const readline = require('readline');
const path = require('path');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\be7453fd-e8f5-4f42-b5d9-92edba646a3f\\.system_generated\\logs\\transcript.jsonl";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("=== USER REQUESTS IN PAST CONVERSATION ===");
  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT') {
        console.log(`[Step ${obj.step_index}] Created: ${obj.created_at}`);
        console.log(obj.content);
        console.log("-----------------------------------------");
      }
    } catch (e) {
      // Ignore parse errors if any line is invalid JSON
    }
  }
}

main().catch(console.error);
