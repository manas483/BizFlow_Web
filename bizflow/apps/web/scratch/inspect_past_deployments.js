const { execSync } = require('child_process');

const urls = [
  "bizflow-lxyj1zmc5-sachanmanas483-7151s-projects.vercel.app",
  "bizflow-5g1vqv4at-sachanmanas483-7151s-projects.vercel.app",
  "bizflow-gj5b6i808-sachanmanas483-7151s-projects.vercel.app"
];

async function main() {
  for (const url of urls) {
    console.log(`\n=========================================`);
    console.log(`Inspecting: ${url}`);
    console.log(`=========================================`);
    
    try {
      const output = execSync(`npx vercel inspect ${url} --format=json`, { encoding: 'utf8' });
      const data = JSON.parse(output);
      
      console.log(`Project: ${data.name}`);
      console.log(`Created At: ${new Date(data.createdAt).toISOString()}`);
      
      // Look for env variables in the metadata
      if (data.env) {
        console.log("Found env variables:", data.env);
      } else {
        console.log("No env variables exposed directly in top-level JSON.");
      }
      
      // Let's print the entire JSON keys to see where env could be hidden
      console.log("Available top-level keys:", Object.keys(data));
      
      // Search for any postgres strings in the entire JSON object
      const jsonStr = JSON.stringify(data);
      const match = jsonStr.match(/postgres[^\s"']*/gi);
      if (match) {
        console.log("Match found:", match);
      } else {
        console.log("No postgres string found in raw JSON.");
      }

    } catch (err) {
      console.error(`Failed to inspect ${url}:`, err.message);
    }
  }
}

main().catch(console.error);
