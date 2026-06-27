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

    console.log(`\n=== ALL BRANCH-RELATED OPERATIONS FOR PROJECT ${projectId} ===`);
    const opsData = await fetchNeon(`https://console.neon.tech/api/v2/projects/${projectId}/operations`, token);
    console.log(`Total operations fetched: ${opsData.operations.length}`);

    const targetActions = ['create_branch', 'delete_branch', 'delete_timeline', 'restore_branch', 'timeline_archive', 'timeline_unarchive'];
    
    for (const op of opsData.operations) {
      if (targetActions.includes(op.action) || op.action.includes('delete') || op.action.includes('branch')) {
        console.log(`- Action: ${op.action}, Status: ${op.status}, Branch ID: ${op.branch_id || 'N/A'}, Created At: ${op.created_at}`);
      }
    }

  } catch (err) {
    console.error("Error querying Neon API:", err.message);
  }
}

main().catch(console.error);
