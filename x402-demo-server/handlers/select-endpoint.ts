import type { Context } from 'hono';
import { readReputation } from './lib/reputation-store';

interface Bid {
  endpoint_path: string;
  price: number;
  confidence: number;
  latency_ms: number;
  reputation_score: number;
  score?: number;
}

/**
 * POST /select-endpoint
 * Bids and selects the best endpoint for a given category.
 */
export async function handleSelectEndpointRequest(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { category } = body;

    const validCategories = ['resume_screening', 'contract_analysis', 'invoice_extraction', 'code_review', 'seo_audit'];
    if (!category || !validCategories.includes(category)) {
      return c.json({ error: `Valid category is required: ${validCategories.join(', ')}` }, 400);
    }

    const { readReputationAsync } = await import('./lib/reputation-store');
    const repStore = await readReputationAsync();
    const getRep = (path: string) => repStore[path]?.score ?? 0.5;

    // Define endpoint candidates and their metadata
    const candidatesMap: Record<string, [Bid, Bid]> = {
      seo_audit: [
        {
          endpoint_path: '/seo-audit-fast',
          price: 0.10,
          confidence: 0.76,
          latency_ms: 850,
          reputation_score: getRep('/seo-audit-fast'),
        },
        {
          endpoint_path: '/seo-audit-accurate',
          price: 0.25,
          confidence: 0.94,
          latency_ms: 2300,
          reputation_score: getRep('/seo-audit-accurate'),
        },
      ],
      code_review: [
        {
          endpoint_path: '/code-review-fast',
          price: 0.12,
          confidence: 0.78,
          latency_ms: 900,
          reputation_score: getRep('/code-review-fast'),
        },
        {
          endpoint_path: '/code-review-accurate',
          price: 0.30,
          confidence: 0.95,
          latency_ms: 2500,
          reputation_score: getRep('/code-review-accurate'),
        },
      ],
      resume_screening: [
        {
          endpoint_path: '/resume-screen-fast',
          price: 0.10,
          confidence: 0.75,
          latency_ms: 800,
          reputation_score: getRep('/resume-screen-fast'),
        },
        {
          endpoint_path: '/resume-screen-accurate',
          price: 0.25,
          confidence: 0.93,
          latency_ms: 2200,
          reputation_score: getRep('/resume-screen-accurate'),
        },
      ],
      contract_analysis: [
        {
          endpoint_path: '/contract-analyze-fast',
          price: 0.15,
          confidence: 0.75,
          latency_ms: 800,
          reputation_score: getRep('/contract-analyze-fast'),
        },
        {
          endpoint_path: '/contract-analyze-accurate',
          price: 0.35,
          confidence: 0.93,
          latency_ms: 2200,
          reputation_score: getRep('/contract-analyze-accurate'),
        },
      ],
      invoice_extraction: [
        {
          endpoint_path: '/invoice-extract-fast',
          price: 0.08,
          confidence: 0.75,
          latency_ms: 800,
          reputation_score: getRep('/invoice-extract-fast'),
        },
        {
          endpoint_path: '/invoice-extract-accurate',
          price: 0.20,
          confidence: 0.93,
          latency_ms: 2200,
          reputation_score: getRep('/invoice-extract-accurate'),
        },
      ],
    };

    const candidates = candidatesMap[category];

    // Compute price terms normalized relatively
    const invPrice1 = 1 / candidates[0].price;
    const invPrice2 = 1 / candidates[1].price;
    const sumInvPrice = invPrice1 + invPrice2;

    const normPrice1 = invPrice1 / sumInvPrice;
    const normPrice2 = invPrice2 / sumInvPrice;

    // Calculate scores
    // score = (confidence * 0.5) + (reputation_score * 0.3) + (normalized_price_term * 0.2)
    candidates[0].score = (candidates[0].confidence * 0.5) + (candidates[0].reputation_score * 0.3) + (normPrice1 * 0.2);
    candidates[1].score = (candidates[1].confidence * 0.5) + (candidates[1].reputation_score * 0.3) + (normPrice2 * 0.2);

    // Determine the winner (highest score wins)
    const winner = candidates[0].score >= candidates[1].score ? candidates[0] : candidates[1];

    return c.json({
      winner: {
        endpoint_path: winner.endpoint_path,
        price: winner.price,
        confidence: winner.confidence,
      },
      candidates: candidates,
    });
  } catch (error) {
    console.error('Error in select-endpoint handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
