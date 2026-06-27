const fs = require('fs');
const readline = require('readline');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\be7453fd-e8f5-4f42-b5d9-92edba646a3f\\.system_generated\\logs\\transcript.jsonl";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (obj.step_index >= 300 && obj.step_index < 400) {
        console.log(`\n[Step ${obj.step_index}] Source: ${obj.source}, Type: ${obj.type}`);
        if (obj.type === 'USER_INPUT') {
          console.log("USER:", obj.content);
        } else if (obj.type === 'PLANNER_RESPONSE') {
          console.log("MODEL:", obj.content);
          if (obj.tool_calls) {
            console.log("TOOLS:", JSON.stringify(obj.tool_calls, null, 2));
          }
        } else if (obj.type === 'RUN_COMMAND' || obj.type === 'VIEW_FILE' || obj.type === 'WRITE_FILE' || obj.type === 'SYSTEM_MESSAGE') {
          const snippet = obj.content ? obj.content.substring(0, 500) : '';
          console.log(`TOOL OUTPUT (${obj.type}):`, snippet);
        }
      }
    } catch (e) {}
  }
}

main().catch(console.error);
