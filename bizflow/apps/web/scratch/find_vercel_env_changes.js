const fs = require('fs');
const readline = require('readline');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\be7453fd-e8f5-4f42-b5d9-92edba646a3f\\.system_generated\\logs\\transcript.jsonl";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("=== Vercel Environment Variable Commands in Past Conversation ===");
  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'PLANNER_RESPONSE' && obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'run_command' && tc.args.CommandLine.includes('env')) {
            console.log(`\n[Step ${obj.step_index}] Cwd: ${tc.args.Cwd}`);
            console.log(`CMD: ${tc.args.CommandLine}`);
          }
        }
      }
      if (obj.type === 'RUN_COMMAND' && (obj.content || '').includes('env')) {
        // Print first line of output
        const firstLine = obj.content.split('\n')[0];
        console.log(`OUTPUT: ${firstLine}`);
      }
    } catch (e) {}
  }
}

main().catch(console.error);
