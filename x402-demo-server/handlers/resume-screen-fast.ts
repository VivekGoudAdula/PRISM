import type { Context } from 'hono';
import { extractText } from './lib/extract-document';

/**
 * POST /resume-screen-fast
 * Fast resume screening using a faster/cheaper Groq LLM API
 */
export async function handleResumeScreenFastRequest(c: Context) {
  const startTime = Date.now();
  try {
    console.log('✓ PAYMENT VERIFIED - POST /resume-screen-fast handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { task_description, files = [] } = body;

    if (!files || files.length === 0) {
      return c.json({ error: 'No files provided. At least one resume file must be uploaded.' }, 400);
    }

    const getGroqKeys = () => {
      const keys = [];
      if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
      for (let i = 1; i <= 10; i++) {
        const k = process.env[`GROQ_API_KEY_${i}`];
        if (k) keys.push(k);
      }
      return keys;
    };

    const keys = getGroqKeys();
    const candidates: any[] = [];
    let totalLlmLatency = 0;

    for (const file of files) {
      let extracted_text = file.text || '';
      if (!extracted_text && file.content_base64) {
        try {
          const extResult = await extractText(file.filename, file.content_base64);
          extracted_text = extResult.text;
        } catch (err) {
          console.error(`Failed to extract text for ${file.filename}:`, err);
        }
      }
      
      let candidateInfo = {
        name: file.filename,
        match_score: 0.5,
        role: 'Unknown',
        key_skills: [],
      };

      let success = false;
      if (keys.length > 0) {
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          try {
            const llmStart = Date.now();
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
                    role: 'system',
                    content: 'Fast screen: Rate match score (0-1), extract name, role, and top key skills. Return ONLY JSON: { "name": string, "match_score": number, "role": string, "key_skills": string[] }',
                  },
                  {
                    role: 'user',
                    content: `Role: ${task_description}\nText: ${extracted_text.substring(0, 3000)}`,
                  },
                ],
                temperature: 0.1,
              }),
            });

            totalLlmLatency += (Date.now() - llmStart);

            if (response.ok) {
              const data = await response.json();
              const content = data.choices?.[0]?.message?.content?.trim() || '';
              try {
                let cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error('No JSON object found in response');
                const parsed = JSON.parse(jsonMatch[0]);
                candidateInfo = {
                  name: parsed.name || file.filename,
                  match_score: typeof parsed.match_score === 'number' ? parsed.match_score : 0.5,
                  role: parsed.role || 'Unknown',
                  key_skills: Array.isArray(parsed.key_skills) ? parsed.key_skills : [],
                };
                success = true;
                break;
              } catch (e) {
                console.error('Failed to parse candidate JSON content:', content, e);
              }
            }
          } catch (err) {
            console.error(`Error with Groq API key index ${i + 1}:`, err);
          }
        }
      }

      if (!success) {
        console.warn(`Fallback active for fast candidate processing of file: ${file.filename}`);
      }
      candidates.push(candidateInfo);
    }

    return c.json({
      candidates,
      confidence: 0.75,
      latency_ms: totalLlmLatency,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in resume-screen-fast handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
