const fs = require('fs');
const readline = require('readline');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\be7453fd-e8f5-4f42-b5d9-92edba646a3f\\.system_generated\\logs\\transcript_full.jsonl";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let step = 0;
  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (line.includes('db.prisma.io')) {
        console.log(`\n=========================================`);
        console.log(`Step ${obj.step_index} | Source: ${obj.source} | Type: ${obj.type}`);
        console.log(`=========================================`);
        console.log(obj.content);
        if (obj.tool_calls) {
          console.log("TOOL CALLS:", JSON.stringify(obj.tool_calls, null, 2));
        }
        break; // stop at first match
      }
    } catch (e) {}
  }
}

main().catch(console.error);
