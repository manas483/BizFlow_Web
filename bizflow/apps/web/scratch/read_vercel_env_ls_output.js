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
      if (line.includes('vercel env ls') || obj.step_index === 174 || obj.step_index === 175 || obj.step_index === 177 || obj.step_index === 282 || obj.step_index === 283 || obj.step_index === 744 || obj.step_index === 745 || obj.step_index === 749) {
        console.log(`\n[Step ${obj.step_index}] Source: ${obj.source}, Type: ${obj.type}`);
        console.log(obj.content);
      }
    } catch (e) {}
  }
}

main().catch(console.error);
