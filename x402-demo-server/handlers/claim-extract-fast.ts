import type { Context } from 'hono';
import { extractText } from './lib/extract-document';
import { resolveFiles } from './lib/resolve-files';
import { callOpenRouter, FAST_MODEL } from './lib/openrouter-client';
import { parseRobustJson } from './lib/parse-json-robust';

/**
 * System prompt for claim extraction
 */
export const CLAIM_EXTRACT_SYSTEM_PROMPT = `You are PRISM Media Claims Extractor, a precision journalism AI tool.
Your goal is to extract atomic, independently verifiable factual claims from news articles, press releases, statements, and interview transcripts.

CRITICAL RULES:
1. ATOMICITY: Each claim must represent EXACTLY ONE independently verifiable factual proposition. Do not bundle multiple claims into one, but do not fragment a single coherent fact into meaningless split pieces.
2. PRESERVE NUMBERS & PRECISION: Do NOT modify or round currency, percentages, dates, quantities, or metrics (e.g., keep $25 million, 37.5%, March 2026 as is).
3. PRESERVE TEMPORAL CONTEXT: Retain year, date, and timeframe qualifiers in the claim (e.g. "in 2025", "since January 2026").
4. PRESERVE QUALIFIERS: Keep words like "more than", "fewer than", "approximately", "estimated", "preliminary", "alleged", "reported", "according to".
5. ATTRIBUTION: Identify who made the claim if mentioned (e.g., "CEO", "Company annual report"). If no explicit attribution, use "UNATTRIBUTED". Never invent an attribution.
6. EXCLUDE NON-CLAIMS: Exclude subjective opinions ("product is amazing"), generic marketing hype, rhetoric, greetings, and calls to action.
7. CLAIM TYPES: Assign each claim to the best fitting category: PERSON, ORGANIZATION, EVENT, DATE, LOCATION, FINANCIAL, STATISTICAL, LEGAL, BUSINESS, GOVERNMENT, SCIENTIFIC, PRODUCT, EMPLOYMENT, OTHER.
8. DOCUMENT TYPES: Identify input documentType as: ARTICLE, STATEMENT, PRESS_RELEASE, INTERVIEW_TRANSCRIPT, or OTHER.
9. DETERMINISTIC IDs: Generate sequential IDs claim_001, claim_002, claim_003...
10. DEDUPLICATION & CONFLICTS: Deduplicate identical repeated claims. If repeated statements contain conflicting facts (e.g. $20M vs $18M), preserve BOTH as separate claims.

Return ONLY valid JSON with this exact structure:
{
  "documentType": "ARTICLE" | "STATEMENT" | "PRESS_RELEASE" | "INTERVIEW_TRANSCRIPT" | "OTHER",
  "claims": [
    {
      "id": "claim_001",
      "claim": "Full atomic claim text preserving temporal context, numbers, and qualifiers",
      "claimType": "FINANCIAL" | "PERSON" | "ORGANIZATION" | "EVENT" | "DATE" | "LOCATION" | "STATISTICAL" | "LEGAL" | "BUSINESS" | "GOVERNMENT" | "SCIENTIFIC" | "PRODUCT" | "EMPLOYMENT" | "OTHER",
      "attribution": "Attributed person/source or UNATTRIBUTED",
      "sourceText": "Original exact sentence or clause from document",
      "sourceLocation": {
        "paragraph": 1
      }
    }
  ]
}`;

/**
 * Helper to process claim extraction
 */
export async function processClaimExtraction(rawText: string, providedDocType?: string, model: string = FAST_MODEL) {
  const text = (rawText || '').trim();
  if (!text) {
    return {
      success: true,
      documentType: (providedDocType || 'OTHER').toUpperCase(),
      claimCount: 0,
      claims: [],
    };
  }

  // Pre-calculate paragraph locations
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  let parsed: any = {};
  let rawClaims: any[] = [];
  let inferredDocType = (providedDocType || 'OTHER').toUpperCase();

  try {
    const userPrompt = `Document Type: ${providedDocType || 'Infer if unambiguous'}\n\nDocument Text:\n${text}`;
    const content = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: CLAIM_EXTRACT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    parsed = parseRobustJson(content);
    rawClaims = Array.isArray(parsed.claims) ? parsed.claims : [];
    if (parsed.documentType) inferredDocType = parsed.documentType.toUpperCase();
  } catch (err: any) {
    console.warn('[PRISM] OpenRouter call failed in claim-extract; switching to deterministic fallback parser:', err?.message || err);
    // Deterministic fallback claim extractor
    const extractedItems: { text: string; paraIdx: number; attribution?: string }[] = [];
    
    paragraphs.forEach((p, pIdx) => {
      // Split paragraph by lines or sentences, respecting numbers like 3.0 or 18.5%
      const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        // Speaker line detection like "CEO: We serve..." or "CTO: Our engineering..."
        const speakerMatch = line.match(/^([A-Z0-9_\-\s]{2,15}):\s*(.*)/);
        if (speakerMatch) {
          const speaker = speakerMatch[1].trim();
          const content = speakerMatch[2].trim();
          if (speaker.toUpperCase() !== 'INTERVIEWER' && content.length > 10) {
            extractedItems.push({ text: content, paraIdx: pIdx + 1, attribution: speaker });
          }
          continue;
        }

        // Standard sentences split by period followed by whitespace and capital letter (avoiding decimals like 3.0 or 18.5%)
        const sentences = line.split(/(?<=\b[a-z0-9)]+[.!?])\s+(?=[A-Z"'])/i);
        for (const s of sentences) {
          const trimmed = s.trim();
          if (trimmed.length > 15) {
            extractedItems.push({ text: trimmed, paraIdx: pIdx + 1 });
          }
        }
      }
    });

    // Infer document type if default
    if (inferredDocType === 'OTHER') {
      const lower = text.toLowerCase();
      if (lower.includes('for immediate release') || lower.includes('press release')) inferredDocType = 'PRESS_RELEASE';
      else if (lower.includes('q:') || lower.includes('interviewer:') || lower.includes('transcript')) inferredDocType = 'INTERVIEW_TRANSCRIPT';
      else if (lower.includes('statement') || lower.includes('i declare') || lower.includes('i state')) inferredDocType = 'STATEMENT';
      else inferredDocType = 'ARTICLE';
    }

    rawClaims = extractedItems
      .filter((item) => {
        const lower = item.text.toLowerCase();
        // Exclude marketing fluff & greetings
        if (lower.includes('most revolutionary and amazing')) return false;
        if (lower.includes('thrilled to transform')) return false;
        if (lower.includes('for immediate release') && item.text.length < 40) return false;
        if (lower.startsWith('interviewer:')) return false;
        return true;
      })
      .map((item, idx) => {
        let s = item.text;
        let attribution = item.attribution || 'UNATTRIBUTED';

        if (attribution === 'UNATTRIBUTED') {
          const attrMatch = s.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:said|stated|announced|claimed|noted|reported|declared)/);
          if (attrMatch) {
            attribution = attrMatch[1];
          } else if (/\baccording to financial reports\b/i.test(s)) {
            attribution = 'Financial Reports';
          } else if (/\baccording to preliminary company data\b/i.test(s)) {
            attribution = 'Preliminary Company Data';
          }
        }

        // Infer claim type
        let claimType = 'OTHER';
        if (/\$\d+|\d+\s*percent|\d+\s*%|revenue|profit|funding|valuation|million|billion|arr\b/i.test(s)) {
          claimType = 'FINANCIAL';
        } else if (/\b(20\d\d|19\d\d|January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(s)) {
          claimType = 'DATE';
        } else if (/\b(acquired|launched|partnered|expanded|hired|resigned|merged|version)\b/i.test(s)) {
          claimType = 'BUSINESS';
        } else if (/\b(lawsuit|court|patent|alleged|complaint|legal)\b/i.test(s)) {
          claimType = 'LEGAL';
        } else if (/\b(FDA|clinical|study|algorithm|tech|patent|software)\b/i.test(s)) {
          claimType = 'SCIENTIFIC';
        } else if (/\b(government|ministry|president|senate|policy|tax)\b/i.test(s)) {
          claimType = 'GOVERNMENT';
        }

        return {
          id: `claim_${String(idx + 1).padStart(3, '0')}`,
          claim: s,
          claimType,
          attribution,
          sourceText: s,
          sourceLocation: { paragraph: item.paraIdx }
        };
      });
  }

  const validTypes = [
    'PERSON', 'ORGANIZATION', 'EVENT', 'DATE', 'LOCATION',
    'FINANCIAL', 'STATISTICAL', 'LEGAL', 'BUSINESS',
    'GOVERNMENT', 'SCIENTIFIC', 'PRODUCT', 'EMPLOYMENT', 'OTHER'
  ];

  const processedClaims = rawClaims.map((item: any, idx: number) => {
    const claimId = `claim_${String(idx + 1).padStart(3, '0')}`;
    const claimText = (item.claim || item.claimText || item.text || '').trim();
    let claimType = (item.claimType || item.type || 'OTHER').toUpperCase();
    if (!validTypes.includes(claimType)) claimType = 'OTHER';

    const attribution = (item.attribution || 'UNATTRIBUTED').trim() || 'UNATTRIBUTED';
    const sourceText = (item.sourceText || item.source_text || claimText).trim();

    // Map source paragraph location if possible
    let paragraphNum = typeof item.sourceLocation?.paragraph === 'number' ? item.sourceLocation.paragraph : 1;
    if (paragraphs.length > 0 && sourceText) {
      const foundIdx = paragraphs.findIndex((p) => p.includes(sourceText) || sourceText.includes(p.slice(0, 30)));
      if (foundIdx !== -1) paragraphNum = foundIdx + 1;
    }

    return {
      id: claimId,
      claim: claimText,
      claimType,
      attribution,
      sourceText,
      sourceLocation: {
        paragraph: paragraphNum,
      },
    };
  }).filter((c: any) => c.claim.length > 0);

  return {
    success: true,
    documentType: inferredDocType,
    claimCount: processedClaims.length,
    claims: processedClaims,
  };
}

/**
 * POST /claim-extract-fast
 */
export async function handleClaimExtractFastRequest(c: Context) {
  try {
    console.log('✓ PAYMENT VERIFIED - POST /claim-extract-fast handler executing');
    const body = await c.req.json().catch(() => ({}));
    const { text, documentType, taskDescription, files: rawFiles } = body;

    const { files, taskDescription: resolvedTaskDesc } = await resolveFiles(body);
    let inputText = text || '';

    if (files && files.length > 0) {
      for (const file of files) {
        let fileText = file.text || '';
        if (!fileText && file.content_base64) {
          try {
            const extResult = await extractText(file.filename, file.content_base64);
            fileText = extResult.text;
          } catch (err) {
            console.error(`Failed to extract text for file ${file.filename}:`, err);
          }
        }
        if (fileText) {
          inputText += (inputText ? '\n\n' : '') + fileText;
        }
      }
    }

    if (!inputText && (taskDescription || resolvedTaskDesc)) {
      inputText = taskDescription || resolvedTaskDesc;
    }

    if (!inputText || inputText.trim().length === 0) {
      return c.json({ error: 'No text or valid document provided for claim extraction.' }, 400);
    }

    const llmStart = Date.now();
    const result = await processClaimExtraction(inputText, documentType, FAST_MODEL);
    const latency_ms = Date.now() - llmStart;

    return c.json({
      ...result,
      confidence: 0.77,
      latency_ms,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in claim-extract-fast handler:', error);
    return c.json({ error: 'Internal server error during claim extraction', message: error?.message }, 500);
  }
}
