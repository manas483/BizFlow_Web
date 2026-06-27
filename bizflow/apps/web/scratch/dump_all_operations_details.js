const fs = require('fs');
const path = require('path');

async function getAccessToken() {
  const credsPath = "C:\\Users\\sacha\\.config\\neonctl\\credentials.json";
  if (!fs.existsSync(credsPath)) {
    throw new Error("Credentials file not found.");
  }
  const data = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  return data.access_token;
}

async function fetchNeon(url, token) {
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status} - ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  try {
    const token = await getAccessToken();
    const projectId = "billowing-sun-78559264";

    console.log(`Fetching all operations for project ${projectId}...`);
    const opsData = await fetchNeon(`https://console.neon.tech/api/v2/projects/${projectId}/operations`, token);
    
    console.log(`\n=== ALL RECENT OPERATIONS DETAILS (Total: ${opsData.operations.length}) ===`);
    
    for (const op of opsData.operations) {
      console.log(`- ID: ${op.id}`);
      console.log(`  Action: ${op.action}`);
      console.log(`  Status: ${op.status}`);
      console.log(`  Created At: ${op.created_at}`);
      console.log(`  Updated At: ${op.updated_at}`);
      if (op.branch_id) console.log(`  Branch ID: ${op.branch_id}`);
      if (op.error) console.log(`  Error: ${op.error}`);
    }

  } catch (err) {
    console.error("Error querying Neon API:", err.message);
  }
}

main().catch(console.error);
