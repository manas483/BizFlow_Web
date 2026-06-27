const fs = require('fs');
const readline = require('readline');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\be7453fd-e8f5-4f42-b5d9-92edba646a3f\\.system_generated\\logs\\transcript.jsonl";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("=== Database URLs found in past conversation transcript ===");
  const foundUrls = new Set();
  
  const regex = /(postgres(?:ql)?:\/\/[^\s"'`<>]+)/g;

  for await (const line of rl) {
    let match;
    while ((match = regex.exec(line)) !== null) {
      // Remove trailing quotes, backslashes, braces, parentheses, etc.
      let url = match[1];
      url = url.replace(/\\r\\n/g, '').replace(/\\n/g, '').replace(/\\/g, '');
      url = url.replace(/[)"',;\\}]+$/, '');
      foundUrls.add(url);
    }
  }

  for (const url of foundUrls) {
    console.log(url);
  }
}

main().catch(console.error);
