const { Redis } = require('@upstash/redis');
const fs = require('fs');
const path = require('path');

// Read redis config from .env
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const lines = envContent.split('\n');

const getVal = (name) => {
  const line = lines.find(l => l.startsWith(name + '='));
  if (!line) return null;
  return line.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');
};

const url = getVal('UPSTASH_REDIS_REST_URL');
const token = getVal('UPSTASH_REDIS_REST_TOKEN');

console.log('URL:', url);
console.log('Token length:', token ? token.length : 0);

async function main() {
  if (!url || !token) {
    console.log('Redis URL or Token is missing.');
    return;
  }
  
  const redis = new Redis({ url, token });
  console.log('Sending ping to Redis...');
  try {
    const pingRes = await redis.ping();
    console.log('Ping result:', pingRes);
    
    console.log('Testing limit operation mockup...');
    // test setting a key
    await redis.set('test_antigravity_key', 'hello');
    const val = await redis.get('test_antigravity_key');
    console.log('Get test key:', val);
    await redis.del('test_antigravity_key');
    console.log('Redis is working perfectly!');
  } catch (err) {
    console.error('Redis error occurred:', err);
  }
}

main().catch(console.error);
