import { callPuterAI, FAST_MODEL as PUTER_FAST, ACCURATE_MODEL as PUTER_ACCURATE } from './puter-client';

export const FAST_MODEL = process.env.FAST_MODEL || 'google/gemini-2.5-flash';
export const ACCURATE_MODEL = process.env.ACCURATE_MODEL || 'meta-llama/llama-3.3-70b-instruct';

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
 * Returns keys from environment variables.
 */
export function getOpenRouterKeys(): string[] {
  const keys: string[] = [];
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) {
    keys.push(process.env.OPENROUTER_API_KEY.trim());
  }
  return keys;
}

/**
 * Primary AI Chat Router.
 * Performs completion via Puter AI.
 */
export async function callOpenRouter(options: OpenRouterOptions): Promise<string> {
  // Directly use Puter AI as primary AI engine
  return await callPuterAI(options);
}
