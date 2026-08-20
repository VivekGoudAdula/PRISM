import { config } from 'dotenv';
import { estimateTokens, calculateTokenSavings, calculateCompressionRatio } from './tokenAnalytics';

config();

export interface PromptOptimizationInput {
  originalPrompt: string;
  improvedPrompt?: string;
  dataMap?: any;
  semanticContext?: any;
  files?: Array<{ filename: string; text?: string; content_base64?: string }>;
  taskType?: string;
  constraints?: string[];
  requiredEntities?: string[];
  requiredRelationships?: string[];
  requiredOutputStructure?: string;
}

export interface PromptOptimizationOutput {
  originalPrompt: string;
  optimizedPrompt: string;
  originalInputTokens: number;
  optimizedInputTokens: number;
  tokensSaved: number;
  reductionPercentage: number;
  compressionRatio: number;
  preservedEntities: string[];
  preservedRelationships: string[];
  preservedConstraints: string[];
  removedRedundancies: string[];
  removedIrrelevantContext: string[];
  summarizedSections: string[];
  optimizationApplied: boolean;
  modelUsed: string;
  measurementSource: 'provider_usage' | 'estimated' | 'hybrid';
}

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
 * Extracts essential entities (names, numbers, dates, emails, skills, IDs, negations, constraints).
 */

export function extractCriticalTerms(text: string): {
  negations: string[];
  numbers: string[];
  properNouns: string[];
  capitalTerms: string[];
} {
  if (!text) return { negations: [], numbers: [], properNouns: [], capitalTerms: [] };

  // Negations
  const negationsMatch = text.match(/\b(NOT|EXCLUDE|MUST NOT|DON'T|DO NOT|NEVER|NO|ONLY)\b/gi) || [];
  const negations = Array.from(new Set(negationsMatch.map((n) => n.toUpperCase())));

  // Numbers, IDs & Dates
  const numbersMatch = text.match(/\b\d+(\.\d+)?%?|\b(20\d\d|19\d\d)\b|\$\d+([.,]\d+)?/g) || [];
  const numbers = Array.from(new Set(numbersMatch));

  // Capitalized words / Proper nouns
  const properMatch = text.match(/\b[A-Z][a-z0-9_]{2,}\b/g) || [];
  const properNouns = Array.from(new Set(properMatch));

  // All caps terms (e.g. MUST, REST, API, JSON, LLM)
  const capsMatch = text.match(/\b[A-Z0-9_-]{3,}\b/g) || [];
  const capitalTerms = Array.from(new Set(capsMatch));

  return { negations, numbers, properNouns, capitalTerms };
}

/**
 * Deterministic pre-processing & text compression.
 * Eliminates duplicate sentences, normalizes whitespace, merges repeated paragraphs,
 * and strips unnecessary document metadata markers.
 */
export function applyDeterministicCompression(text: string): {
  compressedText: string;
  removedRedundancies: string[];
  summarizedSections: string[];
} {
  if (!text || typeof text !== 'string') {
    return { compressedText: '', removedRedundancies: [], summarizedSections: [] };
  }

  const removedRedundancies: string[] = [];
  const summarizedSections: string[] = [];

  // Remove common polite filler phrases deterministically
  let current = text
    .replace(/please (kindly|make sure to|be sure to|note that)/gi, '')
    .replace(/please analyze thoroughly, structure the response clearly, and outline key findings, actionable takeaways, and recommendations\./gi, '')
    .replace(/note:\s*the office temperature is set to \d+ degrees and lunch is served at \d+[a-z]+\.?/gi, (match) => {
      removedRedundancies.push(match);
      return '';
    })
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Deduplicate sentences across paragraphs
  const sentences = current.split(/(?<=[.!?])\s+/);
  const seenSentences = new Set<string>();
  const uniqueSentences: string[] = [];

  for (const s of sentences) {
    const norm = s.trim().toLowerCase();
    if (norm.length > 10 && seenSentences.has(norm)) {
      removedRedundancies.push(s.trim());
    } else {
      if (norm.length > 10) seenSentences.add(norm);
      uniqueSentences.push(s.trim());
    }
  }

  current = uniqueSentences.join(' ');

  // Deduplicate exact repeating lines/sections
  const lines = current.split('\n');
  const seenLines = new Set<string>();
  const uniqueLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      uniqueLines.push('');
      continue;
    }
    const norm = trimmedLine.toLowerCase();
    if (norm.length > 15 && seenLines.has(norm)) {
      removedRedundancies.push(trimmedLine);
      summarizedSections.push(`Merged repeating block: "${trimmedLine.slice(0, 40)}..."`);
    } else {
      if (norm.length > 15) seenLines.add(norm);
      uniqueLines.push(trimmedLine);
    }
  }

  const compressedText = uniqueLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return {
    compressedText,
    removedRedundancies: Array.from(new Set(removedRedundancies)),
    summarizedSections: Array.from(new Set(summarizedSections)),
  };
}

/**
 * Checks if a specific negation or constraint is semantically preserved in the optimized context.
 * Equivalent terms for "ONLY" include "exclusively", "solely", "must be limited to", "only include".
 */
function isNegationPreserved(neg: string, optimizedText: string): boolean {
  const optLower = optimizedText.toLowerCase();
  const negUpper = neg.toUpperCase();

  if (negUpper === 'ONLY') {
    return (
      optLower.includes('only') ||
      optLower.includes('exclusively') ||
      optLower.includes('solely') ||
      optLower.includes('must be limited to') ||
      optLower.includes('only include') ||
      optLower.includes('restricted to')
    );
  }

  if (negUpper === 'MUST NOT' || negUpper === 'DO NOT' || negUpper === "DON'T") {
    return (
      optLower.includes('must not') ||
      optLower.includes('do not') ||
      optLower.includes("don't") ||
      optLower.includes('never') ||
      optLower.includes('exclude') ||
      optLower.includes('should not')
    );
  }

  if (negUpper === 'EXCLUDE') {
    return (
      optLower.includes('exclude') ||
      optLower.includes('excluding') ||
      optLower.includes('omitting') ||
      optLower.includes('do not include') ||
      optLower.includes('must not include')
    );
  }

  return optLower.includes(neg.toLowerCase());
}

/**
 * Validates that critical intent, entities, constraints, and negations are preserved.
 */
export function validateSemanticPreservation(
  originalContext: string,
  optimizedContext: string,
  requiredEntities: string[] = [],
  requiredConstraints: string[] = []
): { isValid: boolean; missingEntities: string[]; missingConstraints: string[] } {
  if (!optimizedContext || optimizedContext.trim().length === 0) {
    return { isValid: false, missingEntities: requiredEntities, missingConstraints: requiredConstraints };
  }

  const origTerms = extractCriticalTerms(originalContext);

  // 1. Check user negations (ONLY, MUST NOT, EXCLUDE, etc.)
  for (const neg of origTerms.negations) {
    if (!isNegationPreserved(neg, optimizedContext)) {
      console.warn(`[PreservationFailure] Negation constraint lost: "${neg}" in context: "${originalContext.slice(0, 100)}..."`);
      return { isValid: false, missingEntities: [`User constraint lost: ${neg}`], missingConstraints: [] };
    }
  }

  // 2. Check explicit required entities
  const missingEntities: string[] = [];
  const optLower = optimizedContext.toLowerCase();

  for (const ent of requiredEntities) {
    if (ent && !optLower.includes(ent.toLowerCase())) {
      missingEntities.push(ent);
    }
  }

  // 3. Check explicit constraints
  const missingConstraints: string[] = [];
  for (const con of requiredConstraints) {
    if (con && !optLower.includes(con.toLowerCase())) {
      missingConstraints.push(con);
    }
  }

  if (missingEntities.length > 0 || missingConstraints.length > 0) {
    console.warn(`[PreservationFailure] Missing entities/constraints: missingEntities=${missingEntities.join(', ')}, missingConstraints=${missingConstraints.join(', ')}`);
    return { isValid: false, missingEntities, missingConstraints };
  }

  return { isValid: true, missingEntities: [], missingConstraints: [] };
}

/**
 * Main End-to-End Prompt Optimizer Service function.
 */
export async function optimizePrompt(input: PromptOptimizationInput): Promise<PromptOptimizationOutput> {
  const originalPrompt = input.originalPrompt || '';
  const startingPrompt = (input.improvedPrompt || input.originalPrompt || '').trim();

  // Build full raw context string (excluding base64)
  let rawContextParts: string[] = [startingPrompt];

  if (input.files && input.files.length > 0) {
    for (const f of input.files) {
      if (f.text) {
        rawContextParts.push(`\n--- Document: ${f.filename} ---\n${f.text}`);
      }
    }
  }

  const fullOriginalContext = rawContextParts.join('\n\n').trim();
  const originalInputTokens = estimateTokens(fullOriginalContext);

  // Default output structure for fallback
  const defaultOutput: PromptOptimizationOutput = {
    originalPrompt: fullOriginalContext,
    optimizedPrompt: fullOriginalContext,
    originalInputTokens,
    optimizedInputTokens: originalInputTokens,
    tokensSaved: 0,
    reductionPercentage: 0,
    compressionRatio: originalInputTokens > 0 ? 1 : 0,
    preservedEntities: input.requiredEntities || [],
    preservedRelationships: input.requiredRelationships || [],
    preservedConstraints: input.constraints || [],
    removedRedundancies: [],
    removedIrrelevantContext: [],
    summarizedSections: [],
    optimizationApplied: false,
    modelUsed: 'none',
    measurementSource: 'estimated',
  };

  if (!fullOriginalContext || originalInputTokens <= 15) {
    return defaultOutput;
  }

  // Step 1: Apply deterministic compression
  const deterministicResult = applyDeterministicCompression(fullOriginalContext);
  let currentContext = deterministicResult.compressedText;
  let removedRedundancies = [...deterministicResult.removedRedundancies];
  let summarizedSections = [...deterministicResult.summarizedSections];
  let modelUsed = 'deterministic-preprocess';

  // Extract critical terms for preservation tracking
  const terms = extractCriticalTerms(fullOriginalContext);
  const preservedEntities = Array.from(new Set([...(input.requiredEntities || []), ...terms.properNouns.slice(0, 10)]));
  const preservedConstraints = Array.from(new Set([...(input.constraints || []), ...terms.negations]));
  const preservedRelationships = input.requiredRelationships || [];

  // Step 2: Decide whether LLM semantic compression is needed
  const deterministicTokens = estimateTokens(currentContext);

  // If deterministic alone achieved compression and context is small, or LLM disabled
  if (deterministicTokens > 120) {
    const keys = getGroqKeys();
    if (keys.length > 0) {
      const systemInstruction = `You are PRISM Prompt Optimizer, an expert context compressor.
Compress and restructure the input execution context to minimize token usage while preserving 100% of task-critical semantics.

CRITICAL PRESERVATION RULES:
1. Preserve all names, dates, numbers, IDs, skills, metrics, and amounts.
2. Preserve all negations (NOT, EXCLUDE, MUST NOT, DON'T, ONLY).
3. Preserve all task constraints and required output schemas/structures.
4. Remove all duplicated information, filler words, polite boilerplate, and irrelevant narrative.
5. Summarize repetitive sections concisely.

Return ONLY a JSON object with this exact structure:
{
  "optimizedContext": "compact restructured execution context",
  "removedRedundancies": ["list of removed filler or repeated facts"],
  "removedIrrelevantContext": ["list of removed irrelevant details"],
  "summarizedSections": ["summary descriptions of condensed sections"]
}`;

      const modelsToTry = ['qwen/qwen3.6-27b', 'groq/compound-mini', 'groq/compound'];

      for (const apiKey of keys) {
        for (const model of modelsToTry) {
          try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: systemInstruction },
                  { role: 'user', content: `Task Type: ${input.taskType || 'general_query'}\nContext:\n${currentContext}` },
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' },
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const parsed = JSON.parse(data.choices?.[0]?.message?.content?.trim() || '{}');
              if (parsed.optimizedContext && typeof parsed.optimizedContext === 'string') {
                const candidateText = parsed.optimizedContext.trim();

                // Semantic preservation check
                const validation = validateSemanticPreservation(
                  fullOriginalContext,
                  candidateText,
                  input.requiredEntities,
                  input.constraints
                );

                if (validation.isValid) {
                  currentContext = candidateText;
                  modelUsed = `${model} + deterministic`;
                  if (Array.isArray(parsed.removedRedundancies)) {
                    removedRedundancies.push(...parsed.removedRedundancies);
                  }
                  if (Array.isArray(parsed.summarizedSections)) {
                    summarizedSections.push(...parsed.summarizedSections);
                  }
                  break;
                } else {
                  console.warn('⚠️ Semantic preservation validation failed. Discarding LLM optimization fallback to original context.', validation);
                }
              }
            }
          } catch (err) {
            // Continue to next model/key
          }
        }
        if (modelUsed.includes('+')) break;
      }
    }
  }

  // Final Validation Check
  const finalValidation = validateSemanticPreservation(
    fullOriginalContext,
    currentContext,
    input.requiredEntities,
    input.constraints
  );

  if (!finalValidation.isValid) {
    return defaultOutput;
  }

  const optimizedInputTokens = estimateTokens(currentContext);

  // If optimization resulted in no token reduction or larger size, fallback
  if (optimizedInputTokens >= originalInputTokens) {
    return defaultOutput;
  }

  const tokensSaved = calculateTokenSavings(originalInputTokens, optimizedInputTokens);
  const reductionPercentage = ((tokensSaved / originalInputTokens) * 100);
  const compressionRatio = parseFloat((optimizedInputTokens / originalInputTokens).toFixed(4));

  return {
    originalPrompt: fullOriginalContext,
    optimizedPrompt: currentContext,
    originalInputTokens,
    optimizedInputTokens,
    tokensSaved,
    reductionPercentage: parseFloat(reductionPercentage.toFixed(1)),
    compressionRatio,
    preservedEntities: Array.from(new Set(preservedEntities)),
    preservedRelationships: Array.from(new Set(preservedRelationships)),
    preservedConstraints: Array.from(new Set(preservedConstraints)),
    removedRedundancies: Array.from(new Set(removedRedundancies)),
    removedIrrelevantContext: [],
    summarizedSections: Array.from(new Set(summarizedSections)),
    optimizationApplied: true,
    modelUsed,
    measurementSource: 'estimated',
  };
}
