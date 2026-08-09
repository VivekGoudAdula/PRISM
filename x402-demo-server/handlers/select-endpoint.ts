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
interface RoutingResult {
  winner: {
    endpoint_path: string;
    price: number;
    confidence: number;
    reputation_score: number;
    providerName?: string;
  };
  candidates: Bid[];
  selectedProvider: string;
  routingReason: string;
  explorationUsed: boolean;
  eligibleProviders: string[];
}

/**
 * Helper to select endpoint based on category, prompt description, reputation, and exploration logic.
 */
export async function selectEndpointForTask(category: string, taskDescription: string = ''): Promise<RoutingResult> {
  const { readReputationAsync } = await import('./lib/reputation-store');
  const repStore = await readReputationAsync();
  const getRep = (path: string) => repStore[path]?.score ?? 0.5;
  const getRuns = (path: string) => repStore[path]?.total_runs ?? 0;

  const PROVIDER_NAMES: Record<string, string> = {
    '/seo-audit-fast': 'SEOAudit Fast',
    '/seo-audit-accurate': 'SEOAudit Accurate',
    '/code-review-fast': 'CodeReview Fast',
    '/code-review-accurate': 'CodeReview Accurate',
    '/resume-screen-fast': 'ResumeScreen Fast',
    '/resume-screen-accurate': 'ResumeScreen Accurate',
    '/contract-analyze-fast': 'ContractAnalyze Fast',
    '/contract-analyze-accurate': 'ContractAnalyze Accurate',
    '/invoice-extract-fast': 'InvoiceExtract Fast',
    '/invoice-extract-accurate': 'InvoiceExtract Accurate',
  };

  // Define endpoint candidates and their baseline metadata
  const candidatesMap: Record<string, Bid[]> = {
    seo_audit: [
      { endpoint_path: '/seo-audit-fast', price: 0.10, confidence: 0.76, latency_ms: 850, reputation_score: getRep('/seo-audit-fast') },
      { endpoint_path: '/seo-audit-accurate', price: 0.25, confidence: 0.94, latency_ms: 2300, reputation_score: getRep('/seo-audit-accurate') },
    ],
    code_review: [
      { endpoint_path: '/code-review-fast', price: 0.12, confidence: 0.78, latency_ms: 900, reputation_score: getRep('/code-review-fast') },
      { endpoint_path: '/code-review-accurate', price: 0.30, confidence: 0.95, latency_ms: 2500, reputation_score: getRep('/code-review-accurate') },
    ],
    resume_screening: [
      { endpoint_path: '/resume-screen-fast', price: 0.10, confidence: 0.75, latency_ms: 800, reputation_score: getRep('/resume-screen-fast') },
      { endpoint_path: '/resume-screen-accurate', price: 0.25, confidence: 0.93, latency_ms: 2200, reputation_score: getRep('/resume-screen-accurate') },
    ],
    contract_analysis: [
      { endpoint_path: '/contract-analyze-fast', price: 0.15, confidence: 0.75, latency_ms: 800, reputation_score: getRep('/contract-analyze-fast') },
      { endpoint_path: '/contract-analyze-accurate', price: 0.35, confidence: 0.93, latency_ms: 2200, reputation_score: getRep('/contract-analyze-accurate') },
    ],
    invoice_extraction: [
      { endpoint_path: '/invoice-extract-fast', price: 0.08, confidence: 0.75, latency_ms: 800, reputation_score: getRep('/invoice-extract-fast') },
      { endpoint_path: '/invoice-extract-accurate', price: 0.20, confidence: 0.93, latency_ms: 2200, reputation_score: getRep('/invoice-extract-accurate') },
    ],
  };

  const candidates = candidatesMap[category];
  if (!candidates) {
    throw new Error(`Invalid category for endpoint selection: ${category}`);
  }

  const fastCandidate = candidates.find((c) => c.endpoint_path.includes('-fast'))!;
  const accurateCandidate = candidates.find((c) => c.endpoint_path.includes('-accurate'))!;

  const descLower = taskDescription.toLowerCase();

  // Intent keyword detection
  const fastKeywords = ['quick', 'simple', 'cheap', 'fast', 'initial screening', 'basic', 'speed'];
  const accurateKeywords = ['detailed', 'deep', 'high precision', 'comprehensive', 'thorough', 'high-precision', 'depth', 'complex', 'in-depth'];

  const hasExplicitFast = fastKeywords.some((kw) => descLower.includes(kw));
  const hasExplicitAccurate = accurateKeywords.some((kw) => descLower.includes(kw));

  let winner: Bid;
  let routingReason: string;
  let explorationUsed = false;
  const eligibleProviders: string[] = candidates.map((c) => c.endpoint_path);

  // 1. Explicit ACCURATE requirement (Exploration strictly forbidden)
  if (hasExplicitAccurate && !hasExplicitFast) {
    winner = accurateCandidate;
    routingReason = `Explicit user request for deep/detailed reasoning matched ${accurateCandidate.endpoint_path}`;
  }
  // 2. Explicit FAST requirement (Exploration strictly forbidden)
  else if (hasExplicitFast && !hasExplicitAccurate) {
    winner = fastCandidate;
    routingReason = `Explicit user request for speed/simple/initial screening matched ${fastCandidate.endpoint_path}`;
  }
  // 3. Ambiguous or standard request — Price + Reputation + Capability scoring with controlled 15-20% exploration
  else {
    // Relative price normalization
    const invPrice1 = 1 / candidates[0].price;
    const invPrice2 = 1 / candidates[1].price;
    const sumInvPrice = invPrice1 + invPrice2;
    const normPrice1 = invPrice1 / sumInvPrice;
    const normPrice2 = invPrice2 / sumInvPrice;

    candidates[0].score = (candidates[0].confidence * 0.5) + (candidates[0].reputation_score * 0.3) + (normPrice1 * 0.2);
    candidates[1].score = (candidates[1].confidence * 0.5) + (candidates[1].reputation_score * 0.3) + (normPrice2 * 0.2);

    const primaryWinner = candidates[0].score >= candidates[1].score ? candidates[0] : candidates[1];
    const alternateCandidate = candidates[0].score >= candidates[1].score ? candidates[1] : candidates[0];

    // Exploration Eligibility Checks:
    // - Provider reputation score must not be failing (< 0.45)
    // - Deterministic ~18% exploration roll based on prompt string length + runs count
    const isAltEligible = alternateCandidate.reputation_score >= 0.45;
    
    // Deterministic pseudo-random roll between 0 and 1 using hash of task description
    let hashVal = 0;
    for (let i = 0; i < taskDescription.length; i++) {
      hashVal = (hashVal * 31 + taskDescription.charCodeAt(i)) & 0xffffffff;
    }
    const roll = Math.abs(hashVal % 100) / 100; // 0.00 to 0.99

    // Allow 18% exploration of eligible lower-used alternate provider if not failing
    if (isAltEligible && roll < 0.18) {
      winner = alternateCandidate;
      explorationUsed = true;
      routingReason = `Controlled 18% exploration selected eligible alternate provider ${alternateCandidate.endpoint_path} (reputation ${alternateCandidate.reputation_score})`;
    } else {
      winner = primaryWinner;
      routingReason = `Selected ${primaryWinner.endpoint_path} based on top quality score (confidence ${primaryWinner.confidence}, reputation ${primaryWinner.reputation_score})`;
    }
  }

  const selectedProviderName = PROVIDER_NAMES[winner.endpoint_path] || winner.endpoint_path;

  return {
    winner: {
      endpoint_path: winner.endpoint_path,
      price: winner.price,
      confidence: winner.confidence,
      reputation_score: winner.reputation_score,
      providerName: selectedProviderName,
    },
    candidates,
    selectedProvider: selectedProviderName,
    routingReason,
    explorationUsed,
    eligibleProviders,
  };
}

/**
 * POST /select-endpoint
 * Bids and selects the best endpoint for a given category.
 */
export async function handleSelectEndpointRequest(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { category, task_description = '' } = body;

    const validCategories = ['resume_screening', 'contract_analysis', 'invoice_extraction', 'code_review', 'seo_audit'];
    if (!category || !validCategories.includes(category)) {
      return c.json({ error: `Valid category is required: ${validCategories.join(', ')}` }, 400);
    }

    const routing = await selectEndpointForTask(category, task_description);

    return c.json({
      winner: routing.winner,
      candidates: routing.candidates,
      selectedProvider: routing.selectedProvider,
      routingReason: routing.routingReason,
      explorationUsed: routing.explorationUsed,
      eligibleProviders: routing.eligibleProviders,
    });
  } catch (error: any) {
    console.error('Error in select-endpoint handler:', error);
    return c.json({ error: 'Internal server error', message: error?.message }, 500);
  }
}
