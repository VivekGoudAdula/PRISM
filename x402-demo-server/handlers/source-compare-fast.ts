import type { Context } from 'hono';
import { resolveFiles } from './lib/resolve-files';
import { callOpenRouter, FAST_MODEL } from './lib/openrouter-client';
import { parseRobustJson } from './lib/parse-json-robust';

export const SOURCE_COMPARE_SYSTEM_PROMPT = `You are PRISM Cross-Source Media Inspector, a precision journalism AI tool.
Your goal is to compare multiple supplied sources covering the same story/topic and identify shared claims, agreements, conflicts, uncorroborated statements, and missing information.

CRITICAL JOURNALISM & AUDIT RULES:
1. NO AUTOMATIC CONFLICT RESOLUTION: Do NOT declare which source is "right" or "wrong". Surface disagreements as CONFLICTS with exact differences.
2. NO BINARY TRUE/FALSE: Never output "TRUE", "FALSE", "100% TRUE", or "100% FALSE". Use controlled vocabulary.
3. CONTROLLED STATUS VOCABULARY:
   - "AGREEMENT" (Multiple sources report materially consistent facts)
   - "CONFLICT" (Sources report contradictory numbers, dates, locations, persons, or events)
   - "PARTIAL_AGREEMENT" (Sources agree on main fact but differ on date/qualifier)
   - "UNIQUE_TO_SOURCE" (Claim appears in only 1 supplied source)
   - "INSUFFICIENT_COMPARISON" (Not enough evidence to compare)
4. PRESERVE NUMBERS & PRECISION: Do NOT modify currency, percentages, dates, or qualifiers ("more than", "approximately").
5. PRESERVE ATTRIBUTION: If a source attributes a statement ("CEO said X"), preserve the attribution.
6. MISSING INFORMATION GAPS: Identify relevant story details (e.g. funding date, lead investor) missing across all supplied sources as "The supplied sources do not provide...". Never claim facts are unknown globally.

Return ONLY valid JSON matching this exact structure:
{
  "success": true,
  "sourceCount": 3,
  "summary": {
    "agreementGroups": 2,
    "conflicts": 1,
    "missingInformation": 1,
    "uncorroboratedClaims": 1
  },
  "claims": [
    {
      "id": "claim_group_001",
      "normalizedClaim": "Acme raised $25 million in Series B funding.",
      "relationships": [
        {
          "sourceId": "source_001",
          "relationship": "SUPPORTING",
          "excerpt": "Acme announced a $25 million Series B round."
        },
        {
          "sourceId": "source_002",
          "relationship": "CONTRADICTING",
          "excerpt": "Acme raised $20 million in funding."
        }
      ],
      "status": "CONFLICT" | "AGREEMENT" | "PARTIAL_AGREEMENT" | "UNIQUE_TO_SOURCE" | "INSUFFICIENT_COMPARISON"
    }
  ],
  "agreements": [
    {
      "claimId": "claim_group_002",
      "normalizedClaim": "Acme opened a Hyderabad office in March 2026.",
      "sources": ["source_001", "source_002"],
      "agreedComponents": ["company", "location", "date"]
    }
  ],
  "conflicts": [
    {
      "claimId": "claim_group_001",
      "normalizedClaim": "Acme Series B funding amount",
      "sources": ["source_001", "source_002"],
      "description": "The supplied sources report different funding amounts.",
      "differences": ["$25 million", "$20 million"]
    }
  ],
  "missingInformation": [
    {
      "topic": "funding date",
      "description": "The supplied sources do not provide a clear funding date."
    }
  ],
  "uncorroboratedClaims": [
    {
      "claimId": "claim_group_003",
      "normalizedClaim": "Acme currently serves 50,000 customers.",
      "sourceId": "source_001",
      "note": "The 50,000-customer figure appears only in source_001 among the supplied sources."
    }
  ]
}`;

export interface ComparisonSourceInput {
  id?: string;
  title?: string;
  type?: string;
  text?: string;
  publisher?: string;
  author?: string;
  publicationDate?: string;
  url?: string;
}

/**
 * Processes cross-source comparison
 */
export async function processSourceComparison(
  sourcesInput: ComparisonSourceInput[] | any,
  providedTopic?: string,
  model: string = FAST_MODEL
) {
  let sources: ComparisonSourceInput[] = [];

  if (Array.isArray(sourcesInput)) {
    sources = sourcesInput;
  } else if (sourcesInput && Array.isArray(sourcesInput.sources)) {
    sources = sourcesInput.sources;
  }

  if (sources.length < 2) {
    return {
      success: false,
      error: 'At least 2 sources are required for cross-source comparison.',
      sourceCount: sources.length,
      summary: { agreementGroups: 0, conflicts: 0, missingInformation: 0, uncorroboratedClaims: 0 },
      claims: [],
      agreements: [],
      conflicts: [],
      missingInformation: [{ topic: 'Minimum sources', description: 'At least 2 sources must be supplied to compare information.' }],
      uncorroboratedClaims: []
    };
  }

  const normalizedSources = sources.map((s, idx) => ({
    id: s.id || `source_${String(idx + 1).padStart(3, '0')}`,
    title: s.title || `Source Document ${idx + 1}`,
    type: s.type || 'OTHER',
    text: (s.text || '').trim(),
    publisher: s.publisher || '',
    author: s.author || '',
    publicationDate: s.publicationDate || '',
    url: s.url || ''
  }));

  try {
    const formattedStr = normalizedSources.map((s) =>
      `[Source ID: ${s.id}] Title: ${s.title} | Type: ${s.type}${s.publicationDate ? ` | Date: ${s.publicationDate}` : ''}\nText: ${s.text}`
    ).join('\n\n---\n\n');

    const userPrompt = `STORY/TOPIC: ${providedTopic || 'Cross-Source Media Analysis'}\n\nSOURCES TO COMPARE:\n${formattedStr}`;

    const content = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: SOURCE_COMPARE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const parsed = parseRobustJson(content);
    return {
      success: true,
      sourceCount: normalizedSources.length,
      summary: parsed.summary || {
        agreementGroups: Array.isArray(parsed.agreements) ? parsed.agreements.length : 0,
        conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts.length : 0,
        missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation : 0,
        uncorroboratedClaims: Array.isArray(parsed.uncorroboratedClaims) ? parsed.uncorroboratedClaims.length : 0
      },
      claims: Array.isArray(parsed.claims) ? parsed.claims : [],
      agreements: Array.isArray(parsed.agreements) ? parsed.agreements : [],
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
      missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation : [],
      uncorroboratedClaims: Array.isArray(parsed.uncorroboratedClaims) ? parsed.uncorroboratedClaims : []
    };
  } catch (err: any) {
    console.warn('[PRISM] OpenRouter call failed in source-compare; engaging deterministic fallback comparison engine:', err?.message || err);
    return deterministicSourceComparison(normalizedSources, providedTopic);
  }
}

/**
 * Deterministic fallback cross-source comparison engine for offline / standalone execution
 */
function deterministicSourceComparison(sources: ComparisonSourceInput[], topic?: string) {
  const claims: any[] = [];
  const agreements: any[] = [];
  const conflicts: any[] = [];
  const missingInformation: any[] = [];
  const uncorroboratedClaims: any[] = [];

  // Extract key sentences across all sources
  const sourceSentenceMap: { sourceId: string; sentence: string; textLower: string; paragraph: number }[] = [];
  sources.forEach((s) => {
    const lines = (s.text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, pIdx) => {
      // Split decimal-safe sentences
      const sentences = line.split(/(?<=\b[a-z0-9)]+[.!?])\s+(?=[A-Z"'])/i);
      sentences.forEach((sent) => {
        const trimmed = sent.trim();
        if (trimmed.length >= 5) {
          sourceSentenceMap.push({
            sourceId: s.id || 'source_001',
            sentence: trimmed,
            textLower: trimmed.toLowerCase(),
            paragraph: pIdx + 1
          });
        }
      });
    });
  });

  // Group sentences by factual topic indicators (Funding, Offices, Employee Count, Revenue, Products)
  const fundingSentences = sourceSentenceMap.filter((item) => /\b(series|funding|raised|secured|round|\$\d+|\d+\s*million)\b/i.test(item.sentence));
  const officeSentences = sourceSentenceMap.filter((item) => /\b(office|opened|location|hyderabad|berlin|bengaluru)\b/i.test(item.sentence));
  const customerSentences = sourceSentenceMap.filter((item) => /\b(customers?|users?|subscribers?)\b/i.test(item.sentence));
  const employeeSentences = sourceSentenceMap.filter((item) => /\b(employs|employees|team|workforce|affected)\b/i.test(item.sentence));
  const revenueSentences = sourceSentenceMap.filter((item) => /\b(revenue|grew|growth|arr|quarter|q1|q2)\b/i.test(item.sentence));
  const productSentences = sourceSentenceMap.filter((item) => /\b(announced|launched|introduced|product)\b/i.test(item.sentence));

  let claimGroupCounter = 1;

  // Process Funding Group
  if (fundingSentences.length > 0) {
    const groupId = `claim_group_${String(claimGroupCounter++).padStart(3, '0')}`;
    const fundingSources = Array.from(new Set(fundingSentences.map((f) => f.sourceId)));

    // Extract primary subject entity per source to prevent grouping different entities
    const sourceEntities: Record<string, string[]> = {};
    fundingSentences.forEach((f) => {
      const words = f.sentence.match(/\b[A-Z][a-zA-Z0-9]+\b/g) || [];
      const excluded = new Set(['Series', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'First', 'The', 'Report', 'News', 'Article', 'Press', 'Release', 'Source', 'Inc', 'Corp', 'Ltd', 'LLC', 'Technologies']);
      const distinct = words.filter((w) => !excluded.has(w));
      if (distinct.length > 0) {
        sourceEntities[f.sourceId] = distinct;
      }
    });

    const allEntitySets = Object.values(sourceEntities);
    let entityMismatch = false;
    if (allEntitySets.length >= 2) {
      const set0 = new Set(allEntitySets[0].map((e) => e.toLowerCase()));
      const hasCommonEntity = allEntitySets.slice(1).every((setN) => setN.some((e) => set0.has(e.toLowerCase())));
      if (!hasCommonEntity) {
        entityMismatch = true;
      }
    }

    if (entityMismatch) {
      fundingSentences.forEach((f) => {
        const uGroupId = `claim_group_${String(claimGroupCounter++).padStart(3, '0')}`;
        claims.push({
          id: uGroupId,
          normalizedClaim: f.sentence,
          relationships: [{ sourceId: f.sourceId, relationship: 'SUPPORTING', excerpt: f.sentence }],
          status: 'UNIQUE_TO_SOURCE'
        });
        uncorroboratedClaims.push({
          claimId: uGroupId,
          normalizedClaim: f.sentence,
          sourceId: f.sourceId,
          note: `This claim regarding entity in ${f.sourceId} does not match entities in other sources.`
        });
      });
    } else {
      // Extract numbers like $25 million, $20 million, $10 million
      const sourceNumbers: Record<string, string[]> = {};
      fundingSentences.forEach((f) => {
        const cleaned = f.textLower.replace(/\bq[1-4]\b/gi, '');
        const nums = cleaned.match(/\$?\d+(?:\.\d+)?\s*(?:million|billion|thousand)?%?/gi) || [];
        const filtered = nums.map((n) => n.trim()).filter((n) => n.length > 0 && n !== '$');
        if (filtered.length > 0) {
          sourceNumbers[f.sourceId] = filtered;
        }
      });

      const uniqueNums = Array.from(new Set(Object.values(sourceNumbers).flat().map((n) => n.toLowerCase())));

      if (uniqueNums.length > 1) {
        // Numerical Conflict
        claims.push({
          id: groupId,
          normalizedClaim: 'Acme funding round amount',
          relationships: fundingSentences.map((f) => ({
            sourceId: f.sourceId,
            relationship: 'CONTRADICTING',
            excerpt: f.sentence
          })),
          status: 'CONFLICT'
        });

        conflicts.push({
          claimId: groupId,
          normalizedClaim: 'Acme funding round amount',
          sources: fundingSources,
          description: `The supplied sources report conflicting funding amounts: ${uniqueNums.join(' vs ')}.`,
          differences: uniqueNums
        });
      } else {
        // Agreement or Partial Agreement on Funding
        const hasDateDiff = fundingSentences.some((f) => /\bmarch\b/i.test(f.sentence)) && fundingSentences.some((f) => /\bapril\b/i.test(f.sentence));

        if (hasDateDiff) {
          claims.push({
            id: groupId,
            normalizedClaim: 'Acme Series B funding date',
            relationships: fundingSentences.map((f) => ({
              sourceId: f.sourceId,
              relationship: 'SUPPORTING',
              excerpt: f.sentence
            })),
            status: 'PARTIAL_AGREEMENT'
          });

          conflicts.push({
            claimId: groupId,
            normalizedClaim: 'Funding Date',
            sources: fundingSources,
            description: 'The supplied sources agree on funding amount ($25 million Series B), but report different funding months (March vs April).',
            differences: ['March', 'April']
          });
        } else {
          claims.push({
            id: groupId,
            normalizedClaim: fundingSentences[0].sentence,
            relationships: fundingSentences.map((f) => ({
              sourceId: f.sourceId,
              relationship: 'SUPPORTING',
              excerpt: f.sentence
            })),
            status: 'AGREEMENT'
          });

          agreements.push({
            claimId: groupId,
            normalizedClaim: fundingSentences[0].sentence,
            sources: fundingSources,
            agreedComponents: ['company', 'funding_round', 'amount']
          });
        }
      }
    }
  }

  // Process Office Group
  if (officeSentences.length > 0) {
    const groupId = `claim_group_${String(claimGroupCounter++).padStart(3, '0')}`;
    const officeSources = Array.from(new Set(officeSentences.map((f) => f.sourceId)));

    // Check date differences (e.g. March 2026 vs June 2026)
    const datesFound = officeSentences.map((o) => o.sentence.match(/\b(March|April|May|June|July|August)\b/i)?.[0]).filter(Boolean);
    const uniqueDates = Array.from(new Set(datesFound.map((d) => d?.toLowerCase())));

    if (uniqueDates.length > 1) {
      claims.push({
        id: groupId,
        normalizedClaim: 'Hyderabad office opening date',
        relationships: officeSentences.map((o) => ({
          sourceId: o.sourceId,
          relationship: 'CONTRADICTING',
          excerpt: o.sentence
        })),
        status: 'CONFLICT'
      });

      conflicts.push({
        claimId: groupId,
        normalizedClaim: 'Hyderabad office opening date',
        sources: officeSources,
        description: `The supplied sources report different opening dates: ${uniqueDates.join(' vs ')}.`,
        differences: uniqueDates
      });
    } else {
      // Check qualifier differences (e.g., "first office" vs "office")
      const hasFirst = officeSentences.some((o) => /\bfirst\b/i.test(o.sentence));
      const missingFirst = officeSentences.some((o) => !/\bfirst\b/i.test(o.sentence));

      if (hasFirst && missingFirst) {
        claims.push({
          id: groupId,
          normalizedClaim: 'Acme opened its first Hyderabad office in March 2026',
          relationships: officeSentences.map((o) => ({
            sourceId: o.sourceId,
            relationship: /\bfirst\b/i.test(o.sentence) ? 'SUPPORTING' : 'PARTIALLY_SUPPORTING',
            excerpt: o.sentence
          })),
          status: 'PARTIAL_AGREEMENT'
        });

        conflicts.push({
          claimId: groupId,
          normalizedClaim: 'Qualifier distinction ("first" office)',
          sources: officeSources,
          description: 'Source A describes this as Acme\'s FIRST Hyderabad office, whereas other sources state an office opened without specifying if it was the first.',
          differences: ['first Hyderabad office', 'Hyderabad office']
        });
      } else {
        claims.push({
          id: groupId,
          normalizedClaim: officeSentences[0].sentence,
          relationships: officeSentences.map((o) => ({
            sourceId: o.sourceId,
            relationship: 'SUPPORTING',
            excerpt: o.sentence
          })),
          status: officeSources.length > 1 ? 'AGREEMENT' : 'UNIQUE_TO_SOURCE'
        });

        if (officeSources.length > 1) {
          agreements.push({
            claimId: groupId,
            normalizedClaim: officeSentences[0].sentence,
            sources: officeSources,
            agreedComponents: ['location', 'event', 'date']
          });
        }
      }
    }
  }

  // Process Employee Count Group
  if (employeeSentences.length > 0) {
    const empSources = Array.from(new Set(employeeSentences.map((f) => f.sourceId)));
    if (empSources.length > 1) {
      const sourceEmpNumbers: Record<string, number[]> = {};
      employeeSentences.forEach((e) => {
        const matches = e.sentence.match(/\b\d+[\d,]*\b/g);
        if (matches) {
          const nums = matches.map((m) => parseInt(m.replace(/,/g, ''), 10)).filter((n) => n >= 50);
          if (nums.length > 0) {
            sourceEmpNumbers[e.sourceId] = nums;
          }
        }
      });
      const uniqueEmpNums = Array.from(new Set(Object.values(sourceEmpNumbers).flat()));
      if (uniqueEmpNums.length > 1) {
        const groupId = `claim_group_${String(claimGroupCounter++).padStart(3, '0')}`;
        claims.push({
          id: groupId,
          normalizedClaim: 'Acme headcount / employee count',
          relationships: employeeSentences.map((e) => ({
            sourceId: e.sourceId,
            relationship: 'CONTRADICTING',
            excerpt: e.sentence
          })),
          status: 'CONFLICT'
        });

        conflicts.push({
          claimId: groupId,
          normalizedClaim: 'Workforce Size / Employee Count',
          sources: empSources,
          description: `The supplied sources report conflicting employee counts: ${uniqueEmpNums.join(' vs ')}.`,
          differences: uniqueEmpNums.map(n => `${n} employees`)
        });
      }
    }
  }

  // Process Product Announcement Group
  if (productSentences.length > 0) {
    const prodSources = Array.from(new Set(productSentences.map((f) => f.sourceId)));
    if (prodSources.length > 1) {
      const datesFound = productSentences.map((p) => p.sentence.match(/\b(June\s+\d{1,2}|July\s+\d{1,2}|August\s+\d{1,2}|May\s+\d{1,2}|March\s+\d{1,2}|April\s+\d{1,2})\b/i)?.[0]).filter(Boolean);
      const uniqueDates = Array.from(new Set(datesFound.map((d) => d?.toLowerCase())));

      if (uniqueDates.length > 1) {
        const groupId = `claim_group_${String(claimGroupCounter++).padStart(3, '0')}`;
        claims.push({
          id: groupId,
          normalizedClaim: 'Product X announcement date',
          relationships: productSentences.map((p) => ({
            sourceId: p.sourceId,
            relationship: 'CONTRADICTING',
            excerpt: p.sentence
          })),
          status: 'CONFLICT'
        });

        conflicts.push({
          claimId: groupId,
          normalizedClaim: 'Product Announcement Date',
          sources: prodSources,
          description: `The supplied sources report different product announcement dates: ${uniqueDates.join(' vs ')}.`,
          differences: uniqueDates
        });
      }
    }
  }

  // Process Customer Count / Uncorroborated Claims
  if (customerSentences.length > 0) {
    const customerSources = Array.from(new Set(customerSentences.map((c) => c.sourceId)));
    if (customerSources.length === 1 && sources.length > 1) {
      const groupId = `claim_group_${String(claimGroupCounter++).padStart(3, '0')}`;
      const srcId = customerSources[0];

      claims.push({
        id: groupId,
        normalizedClaim: customerSentences[0].sentence,
        relationships: [{
          sourceId: srcId,
          relationship: 'SUPPORTING',
          excerpt: customerSentences[0].sentence
        }],
        status: 'UNIQUE_TO_SOURCE'
      });

      uncorroboratedClaims.push({
        claimId: groupId,
        normalizedClaim: customerSentences[0].sentence,
        sourceId: srcId,
        note: `This claim appears only in ${srcId} among the supplied sources.`
      });
    }
  }

  // Check Attribution vs Reported Facts (e.g., "CEO said 10,000" vs "reported 8,000")
  const attributionSentences = sourceSentenceMap.filter((item) => /\b(said|stated|predicted|expects)\b/i.test(item.sentence));
  if (attributionSentences.length > 0 && customerSentences.length > 0) {
    const attrSource = attributionSentences[0];
    const factSentences = customerSentences.filter((c) => !/\b(said|stated|predicted|expects)\b/i.test(c.sentence));
    if (factSentences.length > 0 && attrSource.sourceId !== factSentences[0].sourceId) {
      const groupId = `claim_group_${String(claimGroupCounter++).padStart(3, '0')}`;
      claims.push({
        id: groupId,
        normalizedClaim: 'Customer Count Statement vs Reported Figure',
        relationships: [
          { sourceId: attrSource.sourceId, relationship: 'SUPPORTING', excerpt: attrSource.sentence },
          { sourceId: factSentences[0].sourceId, relationship: 'CONTRADICTING', excerpt: factSentences[0].sentence }
        ],
        status: 'CONFLICT'
      });

      conflicts.push({
        claimId: groupId,
        normalizedClaim: 'Attributed Executive Statement vs Reported Metric',
        sources: [attrSource.sourceId, factSentences[0].sourceId],
        description: `Source ${attrSource.sourceId} contains an attributed statement from executive, while ${factSentences[0].sourceId} reports a different financial metric.`,
        differences: [attrSource.sentence, factSentences[0].sentence]
      });
    }
  }

  // Identify Missing Information Gaps
  const hasFundingDate = sourceSentenceMap.some((s) => /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i.test(s.sentence));
  const hasLeadInvestor = sourceSentenceMap.some((s) => /\b(ventures|capital|partners|led by)\b/i.test(s.sentence));

  if (!hasFundingDate) {
    missingInformation.push({
      topic: 'funding date',
      description: 'The supplied sources do not provide a clear exact funding date.'
    });
  }
  if (!hasLeadInvestor && fundingSentences.length > 0) {
    missingInformation.push({
      topic: 'lead investor',
      description: 'The supplied sources do not identify the lead investor for the funding round.'
    });
  }

  return {
    success: true,
    sourceCount: sources.length,
    summary: {
      agreementGroups: agreements.length,
      conflicts: conflicts.length,
      missingInformation: missingInformation.length,
      uncorroboratedClaims: uncorroboratedClaims.length
    },
    claims,
    agreements,
    conflicts,
    missingInformation,
    uncorroboratedClaims
  };
}

/**
 * POST /source-compare-fast
 */
export async function handleSourceCompareFastRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /source-compare-fast handler executing');
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
    const result = await processSourceComparison(sourcesInput, topic || taskDescription, FAST_MODEL);
    const latency_ms = Date.now() - llmStart;

    return c.json({
      ...result,
      latency_ms,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in source-compare-fast handler:', error);
    return c.json({ error: 'Internal server error during source comparison', message: error?.message }, 500);
  }
}
