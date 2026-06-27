const fs = require('fs');
const readline = require('readline');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\be7453fd-e8f5-4f42-b5d9-92edba646a3f\\.system_generated\\logs\\transcript_full.jsonl";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (obj.step_index === 418 || obj.step_index === 419 || obj.step_index === 420) {
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
