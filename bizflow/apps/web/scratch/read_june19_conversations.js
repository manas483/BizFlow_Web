const fs = require('fs');
const readline = require('readline');
const path = require('path');

const conversationIds = [
  "dc9dc313-86e3-46cb-ae56-6d8e44c4fc35",
  "e146a1c1-9255-40b0-bd89-726b950a9965",
  "fe295ecc-eaac-45d9-8b31-debe1f8ff14b"
];

const brainDir = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain";

async function scanLogs(convId) {
  const logPath = path.join(brainDir, convId, ".system_generated", "logs", "transcript_full.jsonl");
  if (!fs.existsSync(logPath)) {
    console.log(`Log file not found for ${convId}: ${logPath}`);
    return;
  }

  console.log(`\n========================================`);
  console.log(`SCANNING CONVERSATION: ${convId}`);
  console.log(`========================================`);

  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const searchKeywords = ['migrate', 'reset', 'db push', 'wipe', 'delete', 'postgres'];

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      const content = obj.content || '';
      
      let matched = false;
      for (const kw of searchKeywords) {
        if (content.toLowerCase().includes(kw)) {
          matched = true;
          break;
        }
      }
      
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'run_command' && (tc.args.CommandLine.includes('prisma') || tc.args.CommandLine.includes('db'))) {
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        console.log(`[Step ${obj.step_index}] Source: ${obj.source}`);
        console.log(`  Content: ${content.substring(0, 150).trim()}...`);
        if (obj.tool_calls) {
          console.log(`  Tools:`, JSON.stringify(obj.tool_calls.map(t => t.args?.CommandLine || t.name)));
        }
      }
    } catch (e) {}
  }
}

async function main() {
  for (const convId of conversationIds) {
    await scanLogs(convId);
  }
}

main().catch(console.error);
