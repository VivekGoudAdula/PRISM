/**
 * PRISM AI Router — Groq-Powered.
 *
 * This module is the centralized AI call point for ALL PRISM handlers.
 * Previously routed to OpenRouter; now routes to Groq with multi-key
 * management, rate limiting, and intelligent failover.
 *
 * The exported interface (callOpenRouter, FAST_MODEL, ACCURATE_MODEL, etc.)
 * remains unchanged so that all existing handler imports continue to work
 * without modification.
 */

import { generateAIResponse } from '../../services/groq';

/** Default fast model — uses Groq model from env or the specified default */
export const FAST_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

/** Default accurate model — uses Groq model from env or the specified default */
export const ACCURATE_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
}

/**
 * Returns configured Groq API key availability status.
 * Returns non-empty array if any keys are configured (maintains API compat).
 */
export function getOpenRouterKeys(): string[] {
  const keys: string[] = [];
  if (process.env.GROQ_API_KEY_1?.trim()) keys.push('groq_key_1');
  if (process.env.GROQ_API_KEY_2?.trim()) keys.push('groq_key_2');
  if (process.env.GROQ_API_KEY_3?.trim()) keys.push('groq_key_3');
  // Backward compat: also check legacy OpenRouter key
  if (keys.length === 0 && process.env.OPENROUTER_API_KEY?.trim()) {
    keys.push('openrouter_legacy');
  }
  return keys;
}

/**
 * Primary AI Chat Router — Groq-powered.
 *
 * Converts the existing OpenRouter-style call interface into a Groq
 * generateAIResponse() call. All existing handlers call this function
 * via `import { callOpenRouter } from './lib/openrouter-client'`.
 *
 * The function preserves the original interface:
 * - Accepts messages array with system/user/assistant roles
 * - Returns the raw text content string
 * - Throws on failure (handlers catch and use fallbacks)
 *
 * @param options - Chat completion options (model, messages, temperature, etc.)
 * @returns The AI-generated text content
 * @throws Error if all Groq keys fail
 */
export async function callOpenRouter(options: OpenRouterOptions): Promise<string> {
  const requestedModel = options.model || FAST_MODEL;

  // Extract system and user messages from the messages array
  const systemMessages = options.messages.filter((m) => m.role === 'system');
  const userMessages = options.messages.filter((m) => m.role === 'user');

  const systemPrompt = systemMessages.map((m) => m.content).join('\n\n') || 'You are a helpful AI assistant.';
  const userPrompt = userMessages.map((m) => m.content).join('\n\n') || '';

  // Derive endpoint name from system prompt for logging
  const endpointName = deriveEndpointName(systemPrompt);

  console.log(`[AI Router] Routing request to Groq model: ${requestedModel}`);

  const result = await generateAIResponse({
    systemPrompt,
    userPrompt,
    model: requestedModel,
    temperature: options.temperature ?? 0.2,
    maxTokens: options.max_tokens ?? 2500,
    responseFormat: options.response_format,
    endpointName,
  });

  return result.content;
}

/**
 * Derives a human-readable endpoint name from the system prompt for logging.
 *
 * @param systemPrompt - The system prompt text
 * @returns A short endpoint descriptor
 */
function deriveEndpointName(systemPrompt: string): string {
  const lower = systemPrompt.toLowerCase();

  if (lower.includes('code review') || lower.includes('code analysis')) return 'code-review';
  if (lower.includes('resume') || lower.includes('candidate')) return 'resume-screen';
  if (lower.includes('seo') || lower.includes('search engine')) return 'seo-audit';
  if (lower.includes('contract') || lower.includes('clause')) return 'contract-analyze';
  if (lower.includes('invoice') || lower.includes('line_items')) return 'invoice-extract';
  if (lower.includes('claim') && lower.includes('extract')) return 'claim-extract';
  if (lower.includes('claim') && lower.includes('verif')) return 'claim-verify';
  if (lower.includes('source') && lower.includes('compar')) return 'source-compare';
  if (lower.includes('newsroom') || lower.includes('research')) return 'news-research';
  if (lower.includes('chat')) return 'chat-reply';
  if (lower.includes('classify') || lower.includes('task')) return 'classify-task';

  return 'ai-request';
}
