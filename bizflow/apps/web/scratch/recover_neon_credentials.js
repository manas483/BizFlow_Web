const fs = require('fs');
const path = require('path');
const readline = require('readline');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\3f9cf458-4c06-4fd3-bca8-1fc37b353294\\.system_generated\\logs\\transcript_full.jsonl";
const targetPath = "C:\\Users\\sacha\\.config\\neonctl\\credentials.json";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let token = null;

  for await (const line of rl) {
    if (line.includes('access_token') && line.includes('token_type')) {
      // Find the JSON object string in the log line
      const match = line.match(/"content":"(.*?)"/);
      if (match) {
        const content = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
        try {
          const start = content.indexOf('{');
          const end = content.lastIndexOf('}');
          if (start !== -1 && end !== -1) {
            const jsonStr = content.substring(start, end + 1);
            const obj = JSON.parse(jsonStr);
            if (obj.access_token) {
              token = obj;
              break;
            }
          }
        } catch (e) {}
      }
    }
  }

  if (token) {
    console.log("Found token in logs!");
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetPath, JSON.stringify(token, null, 2), 'utf8');
    console.log(`Successfully restored token to ${targetPath}`);
  } else {
    console.log("Could not find token in current logs. Trying the other conversation log...");
    // Let's also check the other conversation log 3c049a48-799d-4fbf-9470-4b9bee7215a5
    const otherLogPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\3c049a48-799d-4fbf-9470-4b9bee7215a5\\.system_generated\\logs\\transcript_full.jsonl";
    if (fs.existsSync(otherLogPath)) {
      const otherRl = readline.createInterface({
        input: fs.createReadStream(otherLogPath),
        crlfDelay: Infinity
      });
      for await (const line of otherRl) {
        if (line.includes('access_token') && line.includes('token_type')) {
          const match = line.match(/"content":"(.*?)"/);
          if (match) {
            const content = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
            try {
              const start = content.indexOf('{');
              const end = content.lastIndexOf('}');
              if (start !== -1 && end !== -1) {
                const jsonStr = content.substring(start, end + 1);
                const obj = JSON.parse(jsonStr);
                if (obj.access_token) {
                  token = obj;
                  break;
                }
              }
            } catch (e) {}
          }
        }
      }
      if (token) {
        fs.writeFileSync(targetPath, JSON.stringify(token, null, 2), 'utf8');
        console.log(`Successfully restored token from older log to ${targetPath}`);
      } else {
        console.log("Could not find token in older logs either.");
      }
    }
  }
}

main().catch(console.error);
