const fs = require('fs');
const readline = require('readline');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\3c049a48-799d-4fbf-9470-4b9bee7215a5\\.system_generated\\logs\\transcript_full.jsonl";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("=== Searching for database references in past conversation 3c049a48-799d-4fbf-9470-4b9bee7215a5 ===");
  
  const foundUrls = new Set();
  const regex = /(postgres(?:ql)?:\/\/[^\s"'`<>]+)/g;

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      let match;
      while ((match = regex.exec(line)) !== null) {
        let url = match[1];
        url = url.replace(/\\r\\n/g, '').replace(/\\n/g, '').replace(/\\/g, '');
        url = url.replace(/[)"',;\\}]+$/, '');
        if (!foundUrls.has(url)) {
          foundUrls.add(url);
          console.log(`[Step ${obj.step_index}] Found URL: ${url}`);
        }
      }
      
      // Also search for references to sales counts or customer counts
      if (line.includes('50 sales') || line.includes('50 customer') || line.includes('more than 50')) {
        console.log(`[Step ${obj.step_index}] Text match: ${obj.content ? obj.content.substring(0, 200) : 'No content'}...`);
      }
    } catch (e) {}
  }
}

main().catch(console.error);
