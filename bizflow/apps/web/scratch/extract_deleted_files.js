const fs = require('fs');
const readline = require('readline');
const path = require('path');

const transcriptPath = "C:\\Users\\sacha\\.gemini\\antigravity-ide\\brain\\be7453fd-e8f5-4f42-b5d9-92edba646a3f\\.system_generated\\logs\\transcript.jsonl";

async function main() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const targetFiles = [
    'scan_orphaned_records.js',
    'check_all_users_data.js',
    'check_archived_project_data.js',
    'check_local_pg.js',
    'check_neon_data.js',
    'list_neon_branches.js',
    'list_neon_dbs.js'
  ];

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'PLANNER_RESPONSE' && obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'write_to_file') {
            const filepath = tc.args.TargetFile;
            const basename = path.basename(filepath.replace(/"/g, ''));
            if (targetFiles.includes(basename)) {
              console.log(`\n=========================================`);
              console.log(`FOUND FILE: ${basename} (Step ${obj.step_index})`);
              console.log(`=========================================`);
              console.log(tc.args.CodeContent);
            }
          }
        }
      }
    } catch (e) {}
  }
}

main().catch(console.error);
