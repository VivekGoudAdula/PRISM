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
      let semantic_map = file.semantic_map;
      if (!semantic_map) {
        let extracted_text = file.text || '';
        if (!extracted_text && file.content_base64) {
          try {
            const extResult = await extractText(file.filename, file.content_base64);
            extracted_text = extResult.text;
          } catch (err) {
            console.error(`Failed to extract text for ${file.filename}:`, err);
          }
        }
        const { buildSemanticMap } = await import('./lib/semantic-map');
        const mapRes = await buildSemanticMap('resume_screening', extracted_text, file.filename);
        semantic_map = mapRes.map;
      }
      
      let candidateInfo = {
        name: semantic_map?.name || file.filename,
        match_score: 0.5,
        role: 'Unknown',
        key_skills: [],
        primary_domain: 'Unknown',
        alternative_roles: [] as string[],
        reason: '',
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
                    content: 'Fast screen: Rate match score (0-1), extract name (use candidate name from semantic map), role, top key skills, primary_domain, alternative_roles, and reason (concise score rationale) based on structured resume semantic map. Return ONLY JSON: { "name": string, "match_score": number, "role": string, "key_skills": string[], "primary_domain": string, "alternative_roles": string[], "reason": string }',
                  },
                  {
                    role: 'user',
                    content: `Role: ${task_description}\nSemantic Map JSON: ${JSON.stringify(semantic_map)}`,
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
                  name: parsed.name && parsed.name !== 'Candidate' && parsed.name !== 'Not Provided' ? parsed.name : (semantic_map?.name || file.filename),
                  match_score: typeof parsed.match_score === 'number' ? parsed.match_score : 0.5,
                  role: parsed.role || 'Unknown',
                  key_skills: Array.isArray(parsed.key_skills) ? parsed.key_skills : [],
                  primary_domain: parsed.primary_domain || 'Unknown',
                  alternative_roles: Array.isArray(parsed.alternative_roles) ? parsed.alternative_roles : [],
                  reason: parsed.reason || (parsed.match_score < 0.5 ? 'Resume shows limited experience relative to the target role requirements.' : 'Candidate profile evaluated against target role.'),
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
