import { callPuterAI, PuterAIOptions, FAST_MODEL as PUTER_FAST, ACCURATE_MODEL as PUTER_ACCURATE } from './puter-client';

export const FAST_MODEL = process.env.FAST_MODEL || PUTER_FAST;
export const ACCURATE_MODEL = process.env.ACCURATE_MODEL || PUTER_ACCURATE;

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

export interface OpenRouterResponse {
  id?: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Returns keys (kept for backwards compatibility).
 */
export function getOpenRouterKeys(): string[] {
  return ['puter-ai-key'];
}

export const FREE_FALLBACK_MODELS = [
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'deepseek-chat',
];

/**
 * Delegated OpenRouter API client to perform completions via Puter AI.
 * Replaces OpenRouter credit requirements with Puter AI zero-credit models.
 */
export async function callOpenRouter(options: OpenRouterOptions): Promise<string> {
  console.log(`[AI Router] Executing AI chat completion via Puter AI...`);
  return callPuterAI({
    model: options.model,
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    response_format: options.response_format,
  });
}
