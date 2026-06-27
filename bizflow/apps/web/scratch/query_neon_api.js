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
    console.log("Got access token from local credentials.");

    console.log("Fetching organizations...");
    const orgsData = await fetchNeon('https://console.neon.tech/api/v2/organizations', token);
    console.log("\n=== ALL ORGANIZATIONS ===");
    console.log(JSON.stringify(orgsData, null, 2));

  } catch (err) {
    console.error("Error querying Neon API:", err.message);
  }
}

main().catch(console.error);
