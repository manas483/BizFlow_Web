const fs = require('fs');
const readline = require('readline');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\3c049a48-799d-4fbf-9470-4b9bee7215a5\\.system_generated\\logs\\transcript_full.jsonl";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (obj.step_index >= 751 && obj.step_index <= 850) {
        console.log(`\n[Step ${obj.step_index}] Source: ${obj.source}, Type: ${obj.type}`);
        console.log(obj.content);
        if (obj.tool_calls) {
          console.log("TOOLS:", JSON.stringify(obj.tool_calls, null, 2));
        }
        console.log("-----------------------------------------");
      }
    } catch (e) {}
  }
}

main().catch(console.error);
