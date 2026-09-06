import type { Context } from 'hono';
import { processSourceComparison, ComparisonSourceInput } from './source-compare-fast';
import { resolveFiles } from './lib/resolve-files';
import { ACCURATE_MODEL } from './lib/openrouter-client';

/**
 * POST /source-compare-accurate
 * High-precision deep reasoning cross-source comparison
 */
export async function handleSourceCompareAccurateRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /source-compare-accurate handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { sources, topic, taskDescription } = body;

    let sourcesInput = sources;
    if (!sourcesInput || !Array.isArray(sourcesInput) || sourcesInput.length === 0) {
      const resolved = await resolveFiles(body);
      if (resolved.files && resolved.files.length >= 2) {
        sourcesInput = resolved.files.map((f, idx) => ({
          id: `source_${String(idx + 1).padStart(3, '0')}`,
          title: f.filename,
          type: 'OTHER',
          text: f.text || ''
        }));
      }
    }

    const llmStart = Date.now();
    const result = await processSourceComparison(sourcesInput, topic || taskDescription, ACCURATE_MODEL);
    const latency_ms = Date.now() - llmStart;

    return c.json({
      ...result,
      tier: 'ACCURATE',
      latency_ms,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in source-compare-accurate handler:', error);
    return c.json({ error: 'Internal server error during accurate source comparison', message: error?.message }, 500);
  }
}
