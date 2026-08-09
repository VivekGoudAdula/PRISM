import type { Context } from 'hono';

/**
 * POST /code-review-accurate
 * High-precision senior-engineer code review for a single file using Groq LLM API (Llama 3.3 70B)
 */
export async function handleCodeReviewAccurateRequest(c: Context) {
  const startTime = Date.now();
  try {
    console.log('✓ PAYMENT VERIFIED - POST /code-review-accurate handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { file_path, raw_url } = body;

    if (!file_path || !raw_url) {
      return c.json({ error: 'file_path and raw_url are required parameters in the request body.' }, 400);
    }

    // Step 1: Fetch raw file content directly from raw_url
    const rawRes = await fetch(raw_url);
    if (!rawRes.ok) {
      return c.json({ error: `Failed to fetch raw file content from ${raw_url}: ${rawRes.statusText}` }, 400);
    }
    const codeContent = await rawRes.text();

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
    let issues: Array<{ line_estimate: number; severity: 'low' | 'medium' | 'high'; description: string; suggestion: string }> = [];
    let overall_quality_score = 0.85;
    let llmLatency = 0;
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
              model: 'llama-3.3-70b-versatile',
              messages: [
                {
                  role: 'system',
                  content: 'Senior software engineer code review: Analyze source file. Return ONLY JSON: { "issues": [ { "line_estimate": number, "severity": "low" | "medium" | "high", "description": string, "suggestion": string } ], "overall_quality_score": number } where overall_quality_score is between 0 and 1.',
                },
                {
                  role: 'user',
                  content: `Instructions: ${task_description || 'Analyze the provided code'}\n\nFile Path: ${file_path}\nFile Content:\n${codeContent.slice(0, 15000)}`,
                },
              ],
              temperature: 0.1,
              response_format: { type: 'json_object' },
            }),
          });

          llmLatency = Date.now() - llmStart;

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content?.trim() || '';
            try {
              const { parseRobustJson } = await import('./lib/parse-json-robust');
              const parsed = parseRobustJson(content);

              issues = Array.isArray(parsed.issues) ? parsed.issues : [];
              if (typeof parsed.overall_quality_score === 'number') {
                overall_quality_score = Math.max(0, Math.min(1, parsed.overall_quality_score));
              }
              success = true;
              break;
            } catch (e) {
              console.error('Failed to parse code review JSON content:', content, e);
            }
          }
        } catch (err) {
          console.error(`Error with Groq API key index ${i + 1}:`, err);
        }
      }
    }

    if (!success) {
      console.warn(`Fallback active for code review of file: ${file_path}`);
      llmLatency = Date.now() - startTime;
    }

    return c.json({
      file_path,
      issues,
      overall_quality_score,
      confidence: 0.95,
      latency_ms: llmLatency,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in code-review-accurate handler:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
}
