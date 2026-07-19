import { config } from 'dotenv';
import type { Context } from 'hono';
config();

/**
 * POST /classify-task
 * Classifies a user's task description into a specific category
 */
export async function handleClassifyTaskRequest(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { task_description } = body;

    if (!task_description || typeof task_description !== 'string') {
      return c.json({ error: 'task_description is required' }, 400);
    }

    const getGroqKeys = () => {
      const keys = [];
      if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
      for (let i = 1; i <= 10; i++) {
        const k = process.env[`GROQ_API_KEY_${i}`];
        if (k) keys.push(k);
      }
      console.log(`getGroqKeys: found ${keys.length} keys in process.env`);
      return keys;
    };

    const keys = getGroqKeys();
    let category = 'unsupported';
    let success = false;

    if (keys.length > 0) {
      for (let index = 0; index < keys.length; index++) {
        const groqApiKey = keys[index];
        try {
          console.log(`Attempting Groq API call with key index ${index + 1}...`);
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqApiKey}`,
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: [
                {
                  role: 'system',
                  content: 'Classify this task into exactly one of: resume_screening, contract_analysis, invoice_extraction, unsupported. Respond with only the category name.',
                },
                {
                  role: 'user',
                  content: task_description,
                },
              ],
              temperature: 0,
              max_tokens: 10,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content?.trim() || '';
            const normalized = content.toLowerCase();
            if (normalized.includes('resume_screening')) {
              category = 'resume_screening';
            } else if (normalized.includes('contract_analysis')) {
              category = 'contract_analysis';
            } else if (normalized.includes('invoice_extraction')) {
              category = 'invoice_extraction';
            } else {
              category = 'unsupported';
            }
            success = true;
            console.log(`Successfully classified task with key index ${index + 1}`);
            break;
          } else {
            console.warn(`Groq API key index ${index + 1} failed with status: ${response.status}`);
          }
        } catch (e) {
          console.error(`Error with Groq API key index ${index + 1}:`, e);
        }
      }
    }

    if (!success) {
      console.warn('All Groq API keys failed or none provided. Falling back to local classification.');
      category = localClassify(task_description);
    }

    return c.json({
      category,
      raw_input: task_description,
    });
  } catch (error) {
    console.error('Error in classify-task handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

/**
 * Fallback classification method if LLM API is not available
 */
function localClassify(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes('resume') || desc.includes('cv') || desc.includes('candidate') || desc.includes('hiring')) {
    return 'resume_screening';
  }
  if (desc.includes('contract') || desc.includes('agreement') || desc.includes('nda') || desc.includes('clause') || desc.includes('legal')) {
    return 'contract_analysis';
  }
  if (desc.includes('invoice') || desc.includes('receipt') || desc.includes('bill') || desc.includes('extract invoice')) {
    return 'invoice_extraction';
  }
  return 'unsupported';
}
