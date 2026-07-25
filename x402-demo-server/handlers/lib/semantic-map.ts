import 'dotenv/config';
import { encode } from 'gpt-tokenizer';
import { SavingsLog } from '../../models/AnalyticsData';

/**
 * Interface representing the semantic map extraction output structure and token count statistics.
 */
export interface SemanticMapResult {
  map: Record<string, any>;
  raw_tokens: number;
  map_tokens: number;
}

/**
 * Log savings entry to MongoDB SavingsLog collection
 */
export async function logSavings(filename: string, raw_tokens: number, map_tokens: number) {
  try {
    const tokens_saved = raw_tokens - map_tokens;
    const reduction_percent = raw_tokens > 0 ? parseFloat(((tokens_saved / raw_tokens) * 100).toFixed(2)) : 0;

    await SavingsLog.create({
      filename,
      rawTokens: raw_tokens,
      mapTokens: map_tokens,
      tokensSaved: tokens_saved,
      reductionPercent: reduction_percent,
      timestamp: new Date()
    });

    console.log(`[SemanticMap] Logged token savings to MongoDB for ${filename}: raw=${raw_tokens}, map=${map_tokens}, saved=${tokens_saved} (${reduction_percent}%)`);
  } catch (err) {
    console.error('Failed to log savings to MongoDB:', err);
  }
}

/**
 * Helper to get Groq API Keys from environment
 */
function getGroqKeys(): string[] {
  const keys: string[] = [];
  if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

/**
 * Extract structured semantic map from document raw text.
 */
export async function buildSemanticMap(
  category: string,
  extracted_text: string,
  filename: string = 'document'
): Promise<SemanticMapResult> {
  const rawTokensCount = encode(extracted_text || '').length;

  let promptSystem = '';
  let defaultFallbackMap: Record<string, any> = {};

  if (category === 'resume_screening') {
    promptSystem = 'Extract structured info from the resume raw text. Return ONLY a valid JSON object matching this schema: { "name": string, "contact": string, "skills": string[], "experience": string[], "education": string[], "years_experience": number, "seniority_level": string }. Extract the candidate\'s full name for "name" (e.g. "Jane Doe") and email/phone for "contact". Do not wrap in markdown codeblocks (e.g. no ```json). Do not explain.';
    defaultFallbackMap = {
      name: '',
      contact: '',
      skills: [],
      experience: [],
      education: [],
      years_experience: 0,
      seniority_level: 'Entry-level'
    };
  } else if (category === 'contract_analysis') {
    promptSystem = 'Extract structured info from the contract raw text. Return ONLY a valid JSON object matching this schema: { "parties": string[], "key_terms": string[], "obligations": string[], "duration": string, "termination_clause_present": boolean }. Do not wrap in markdown codeblocks (e.g. no ```json). Do not explain.';
    defaultFallbackMap = {
      parties: [],
      key_terms: [],
      obligations: [],
      duration: 'Unknown',
      termination_clause_present: false
    };
  } else if (category === 'invoice_extraction') {
    promptSystem = 'Extract structured info from the invoice raw text. Return ONLY a valid JSON object matching this schema: { "vendor": string, "line_items": [ { "description": string, "quantity": number, "unit_price": number, "total": number } ], "total_amount": number, "date": string }. Do not wrap in markdown codeblocks (e.g. no ```json). Do not explain.';
    defaultFallbackMap = {
      vendor: 'Unknown',
      line_items: [],
      total_amount: 0,
      date: 'Unknown'
    };
  } else {
    // Unsupported or generic category fallback
    const jsonStr = JSON.stringify({ raw_text: extracted_text.substring(0, 1000) });
    const mapTokensCount = encode(jsonStr).length;
    logSavings(filename, rawTokensCount, mapTokensCount);
    return {
      map: { raw_text: extracted_text },
      raw_tokens: rawTokensCount,
      map_tokens: mapTokensCount
    };
  }

  const keys = getGroqKeys();
  let extractedMap = defaultFallbackMap;
  let success = false;

  if (keys.length > 0 && extracted_text.trim().length > 0) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: promptSystem },
              { role: 'user', content: `Document text:\n${extracted_text.substring(0, 8000)}` }
            ],
            temperature: 0.1,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content?.trim() || '';
          const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            extractedMap = JSON.parse(jsonMatch[0]);
            success = true;
            break;
          }
        }
      } catch (err) {
        console.error(`Groq API key index ${i} failed for buildSemanticMap:`, err);
      }
    }
  }

  if (!success) {
    console.warn(`[SemanticMap] Standard extraction fallback used for category=${category}, filename=${filename}`);
  }

  const mapJsonString = JSON.stringify(extractedMap);
  const mapTokensCount = encode(mapJsonString).length;

  await logSavings(filename, rawTokensCount, mapTokensCount);

  return {
    map: extractedMap,
    raw_tokens: rawTokensCount,
    map_tokens: mapTokensCount
  };
}
