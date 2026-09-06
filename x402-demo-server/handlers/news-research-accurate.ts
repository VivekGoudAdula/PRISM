import type { Context } from 'hono';
import { resolveFiles } from './lib/resolve-files';
import { ACCURATE_MODEL } from './lib/openrouter-client';
import { processNewsResearch } from './news-research-fast';

/**
 * POST /news-research-accurate
 */
export async function handleNewsResearchAccurateRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /news-research-accurate handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { sources, topic, taskDescription } = body;

    let sourcesInput = sources;
    if (!sourcesInput || !Array.isArray(sourcesInput) || sourcesInput.length === 0) {
      const resolved = await resolveFiles(body);
      if (resolved.files && resolved.files.length >= 2) {
        sourcesInput = resolved.files.map((f, idx) => ({
          id: `source_${String(idx + 1).padStart(3, '0')}`,
          name: f.filename,
          title: f.filename,
          type: 'OTHER',
          text: f.text || ''
        }));
      }
    }

    const llmStart = Date.now();
    const result = await processNewsResearch(sourcesInput, topic || taskDescription, ACCURATE_MODEL);
    const latency_ms = Date.now() - llmStart;

    return c.json({
      ...result,
      latency_ms,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in news-research-accurate handler:', error);
    return c.json({ error: 'Internal server error during news research synthesis', message: error?.message }, 500);
  }
}
