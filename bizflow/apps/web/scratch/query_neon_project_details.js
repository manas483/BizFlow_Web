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
    const projectId = "restless-glitter-34381474";

    console.log(`\n=== OPERATIONS FOR PROJECT ${projectId} ===`);
    try {
      const opsData = await fetchNeon(`https://console.neon.tech/api/v2/projects/${projectId}/operations`, token);
      console.log(`Found ${opsData.operations.length} operations. Listing latest 20:`);
      for (const op of opsData.operations.slice(0, 20)) {
        console.log(`- Type: ${op.action}, Status: ${op.status}, Branch ID: ${op.branch_id || 'N/A'}, Created: ${op.created_at}`);
      }
    } catch (e) {
      console.error("Failed to fetch operations:", e.message);
    }

  } catch (err) {
    console.error("Error querying Neon API:", err.message);
  }
}

main().catch(console.error);
