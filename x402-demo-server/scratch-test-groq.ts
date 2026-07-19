import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const keys = [];
if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
for (let i = 1; i <= 10; i++) {
  const k = process.env[`GROQ_API_KEY_${i}`];
  if (k) keys.push(k);
}

console.log(`Loaded ${keys.length} keys.`);

async function testKeys() {
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    console.log(`Testing key index ${i + 1} (${key.substring(0, 10)}...):`);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'user',
              content: 'ping',
            },
          ],
          max_tokens: 5,
        }),
      });

      console.log(`Status: ${response.status} ${response.statusText}`);
      const data = await response.json();
      console.log('Response body:', JSON.stringify(data, null, 2));
    } catch (e: any) {
      console.error('Error:', e.message);
    }
    console.log('--------------------------------------------------');
  }
}

testKeys();
