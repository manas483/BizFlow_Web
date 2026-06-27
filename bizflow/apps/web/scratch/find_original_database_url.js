const fs = require('fs');
const readline = require('readline');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\be7453fd-e8f5-4f42-b5d9-92edba646a3f\\.system_generated\\logs\\transcript_full.jsonl";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("=== Database URLs in Steps 0-300 ===");
  const foundUrls = new Set();
  const regex = /(postgres(?:ql)?:\/\/[^\s"'`<>]+)/g;

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (obj.step_index < 300) {
        let match;
        while ((match = regex.exec(line)) !== null) {
          let url = match[1];
          url = url.replace(/\\r\\n/g, '').replace(/\\n/g, '').replace(/\\/g, '');
          url = url.replace(/[)"',;\\}]+$/, '');
          if (!foundUrls.has(url)) {
            foundUrls.add(url);
            console.log(`[Step ${obj.step_index}] Found: ${url}`);
          }
        }
      }
    } catch (e) {}
  }
}

main().catch(console.error);
