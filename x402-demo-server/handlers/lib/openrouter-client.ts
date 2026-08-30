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
 * Attempts OpenRouter first if key is present; falls back to Puter AI and local engine.
 */
export async function callOpenRouter(options: OpenRouterOptions): Promise<string> {
  const keys = getOpenRouterKeys();
  const requestedModel = options.model || process.env.OPENROUTER_MODEL || ACCURATE_MODEL;

  if (keys.length > 0) {
    const apiKey = keys[0];
    try {
      console.log(`[AI Router] Attempting OpenRouter completion with model: ${requestedModel}`);
      const bodyPayload: Record<string, any> = {
        model: requestedModel,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.max_tokens ?? 2500,
      };

      if (options.response_format) {
        bodyPayload.response_format = options.response_format;
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://prism.ai',
          'X-OpenRouter-Title': 'PRISM AI Router',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && content.trim()) {
          return content.trim();
        }
      } else {
        const errText = await response.text();
        console.warn(`[AI Router] OpenRouter returned status ${response.status}: ${errText}`);
      }
    } catch (err) {
      console.warn(`[AI Router] OpenRouter attempt failed:`, err);
    }
  }

  // Fallback to Puter AI completion engine
  try {
    console.log(`[AI Router] Executing AI chat completion via Puter AI...`);
    return await callPuterAI({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      response_format: options.response_format,
    });
  } catch (puterErr) {
    console.warn(`[AI Router] Puter AI attempt unavailable in server mode:`, puterErr);
    throw new Error('All external AI model providers (OpenRouter / Puter AI) unavailable. Local PRISM engine active.');
  }
}
