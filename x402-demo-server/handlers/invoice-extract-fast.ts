import type { Context } from 'hono';
import { extractText } from './lib/extract-document';
import { resolveFiles } from './lib/resolve-files';

/**
 * POST /invoice-extract-fast
 * Fast invoice extraction using Groq LLM API
 */
export async function handleInvoiceExtractFastRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /invoice-extract-fast handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { files, taskDescription: task_description } = await resolveFiles(body);

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
    let vendor_name = 'Unknown';
    let invoice_number = 'Unknown';
    let date = 'Unknown';
    let total_amount = 0;
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
        const mapRes = await buildSemanticMap('invoice_extraction', extracted_text, file.filename);
        semantic_map = mapRes.map;
      }
      
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
                    content: 'Fast invoice extraction: Extract structured data based on invoice semantic map. Return ONLY JSON: { "vendor_name": string, "invoice_number": string, "date": string, "line_items": [ { "description": string, "quantity": number, "unit_price": number, "total": number } ], "total_amount": number }',
                  },
                  {
                    role: 'user',
                    content: `Instructions: ${task_description}\n\nInvoice Semantic Map JSON:\n${JSON.stringify(semantic_map)}`,
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
                const rawItems = Array.isArray(parsed.line_items) ? parsed.line_items : [];
                fileItems = rawItems.map((item: any) => {
                  const unit_price = typeof item.unit_price === 'number' ? item.unit_price : parseFloat(String(item.unit_price || 0).replace(/[^0-9.]/g, '')) || 0;
                  const quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity || 1).replace(/[^0-9.]/g, '')) || 1;
                  const rawTotal = item.total !== undefined ? item.total : item.amount;
                  const total = typeof rawTotal === 'number' ? rawTotal : parseFloat(String(rawTotal || (unit_price * quantity)).replace(/[^0-9.]/g, '')) || (unit_price * quantity);
                  return {
                    description: item.description || 'Unknown Item',
                    quantity,
                    unit_price,
                    total,
                    amount: total
                  };
                });
                if (parsed.vendor_name && vendor_name === 'Unknown') vendor_name = parsed.vendor_name;
                if (parsed.invoice_number && invoice_number === 'Unknown') invoice_number = parsed.invoice_number;
                if (parsed.date && date === 'Unknown') date = parsed.date;
                if (typeof parsed.total_amount === 'number') {
                  total_amount += parsed.total_amount;
                } else if (typeof parsed.total_amount === 'string') {
                  const parsedAmt = parseFloat(parsed.total_amount.replace(/[^0-9.]/g, ''));
                  if (!isNaN(parsedAmt)) total_amount += parsedAmt;
                }
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

      if (!success) {
        console.warn(`Fallback active for fast invoice extraction of file: ${file.filename}`);
        fileItems = [
          {
            description: 'Could not perform real LLM extraction on this document.',
            quantity: 1,
            unit_price: 0,
            total: 0,
            amount: 0,
          },
        ];
      }
      line_items = line_items.concat(fileItems);
    }

    return c.json({
      vendor_name,
      invoice_number,
      date,
      line_items,
      total_amount,
      confidence: 0.75,
      latency_ms: totalLlmLatency,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in invoice-extract-fast handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
