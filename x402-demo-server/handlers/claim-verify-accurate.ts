import type { Context } from 'hono';
import { processClaimVerification, EvidenceSourceInput } from './claim-verify-fast';
import { resolveFiles } from './lib/resolve-files';
import { ACCURATE_MODEL } from './lib/openrouter-client';

/**
 * POST /claim-verify-accurate
 * High-precision deep reasoning claim verification
 */
export async function handleClaimVerifyAccurateRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /claim-verify-accurate handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { claim, evidence, text, taskDescription } = body;

    const claimInput = claim || text || taskDescription || '';
    const evidenceInput = evidence || (await resolveFiles(body)).files || [];

    const llmStart = Date.now();
    const result = await processClaimVerification(claimInput, evidenceInput, ACCURATE_MODEL);
    const latency_ms = Date.now() - llmStart;

    return c.json({
      ...result,
      tier: 'ACCURATE',
      confidenceScore: result.verification?.confidence === 'HIGH' ? 0.96 : result.verification?.confidence === 'MEDIUM' ? 0.80 : 0.50,
      latency_ms,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in claim-verify-accurate handler:', error);
    return c.json({ error: 'Internal server error during accurate claim verification', message: error?.message }, 500);
  }
}
