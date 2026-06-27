const fs = require('fs');
const readline = require('readline');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\be7453fd-e8f5-4f42-b5d9-92edba646a3f\\.system_generated\\logs\\transcript.jsonl";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("=== COMMAND HISTORY IN PAST CONVERSATION ===");
  
  // We'll match PLANNER_RESPONSE where tool name is run_command
  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      
      // Look for run_command tool calls
      if (obj.type === 'PLANNER_RESPONSE' && obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'run_command') {
            console.log(`\n[Step ${obj.step_index}] Cwd: ${tc.args.Cwd}`);
            console.log(`CMD: ${tc.args.CommandLine}`);
          }
        }
      }
      
      // Look for outputs of commands
      if (obj.type === 'RUN_COMMAND') {
        const outputLines = (obj.content || '').split('\n');
        const firstFewLines = outputLines.slice(0, 5).join('\n');
        console.log(`OUTPUT (first 5 lines):\n${firstFewLines}`);
        console.log("-----------------------------------------");
      }
    } catch (e) {}
  }
}

main().catch(console.error);
