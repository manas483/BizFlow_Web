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
    const projectIds = ["billowing-sun-78559264", "restless-glitter-34381474"];
    
    for (const pid of projectIds) {
      console.log(`\n=========================================`);
      console.log(`Project ID: ${pid}`);
      console.log(`=========================================`);
      
      const branchesData = await fetchNeon(`https://console.neon.tech/api/v2/projects/${pid}/branches`, token);
      console.log(JSON.stringify(branchesData, null, 2));
    }
  } catch (err) {
    console.error("Error querying Neon API:", err.message);
  }
}

main().catch(console.error);
