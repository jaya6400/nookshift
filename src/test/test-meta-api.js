// test-meta-api-fixed.js - fixed param
require('dotenv').config({ path: '.env.local' });
const KEY = process.env.MODEL_API_KEY;
const BASE = process.env.MODEL_BASE_URL || 'https://api.meta.ai/v1';

async function testSpark() {
  console.log('Testing Spark (no reasoning_strength)...');
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.SPARK_MODEL || 'muse-spark-1.3',
      messages: [{ role: 'user', content: 'Return JSON only: {"goal":"make work corner","operations":[{"action":"keep","target":"desk"}]}' }],
      temperature: 0.2
    })
  });
  const data = await res.json();
  console.log('Spark status:', res.status);
  console.log(JSON.stringify(data, null, 2).slice(0, 3000));
}

async function testImage() {
  console.log('\nTesting Image...');
  const res = await fetch(`${BASE}/images/generations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.IMAGE_MODEL || 'muse-image-1.0',
      prompt: 'minimalist small bedroom desk near window, natural light',
      n: 1
    })
  });
  const data = await res.json();
  console.log('Image status:', res.status, 'has b64:', !!data.data?.[0]?.b64_json);
}

(async () => {
  await testSpark();
  await testImage();
})();