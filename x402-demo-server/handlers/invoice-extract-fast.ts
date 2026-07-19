import type { Context } from 'hono';

/**
 * POST /invoice-extract-fast
 * Fast invoice extraction using Groq LLM API
 */
export async function handleInvoiceExtractFastRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /invoice-extract-fast handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { task_description, files = [] } = body;

    if (!files || files.length === 0) {
      return c.json({ error: 'No files provided. At least one invoice file must be uploaded.' }, 400);
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
    let line_items: any[] = [];
    let totalLlmLatency = 0;

    for (const file of files) {
      const extracted_text = file.text || '';
      
      let fileItems = [];
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
                    content: 'Analyze the invoice text. Extract the line items and return ONLY a valid JSON object matching this schema: { "line_items": [ { "description": string, "amount": number } ] }. Do not wrap in markdown codeblocks (e.g. no ```json). Do not explain.',
                  },
                  {
                    role: 'user',
                    content: `Instructions: ${task_description}\n\nInvoice text:\n${extracted_text.substring(0, 8000)}`,
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
                fileItems = Array.isArray(parsed.line_items) ? parsed.line_items : [];
                success = true;
                break;
              } catch (e) {
                console.error('Failed to parse invoice JSON content:', content, e);
              }
            }
          } catch (err) {
            console.error(`Error with Groq API key index ${i + 1}:`, err);
          }
        }
      }
      line_items = line_items.concat(fileItems);
    }

    return c.json({
      line_items,
      confidence: 0.75,
      latency_ms: totalLlmLatency,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in invoice-extract-fast handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
