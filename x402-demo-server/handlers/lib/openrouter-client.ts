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
 * Performs completion via OpenRouter when API key is set; delegates to Puter AI or local engine cleanly.
 */
export async function callOpenRouter(options: OpenRouterOptions): Promise<string> {
  const keys = getOpenRouterKeys();
  const requestedModel = options.model || process.env.OPENROUTER_MODEL || ACCURATE_MODEL;

  if (keys.length > 0) {
    const apiKey = keys[0];
    try {
      console.log(`[AI Router] Sending request to model: ${requestedModel}`);
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
        console.warn(`[AI Router] OpenRouter HTTP ${response.status}: ${errText}`);
      }
    } catch (err) {
      console.warn(`[AI Router] OpenRouter attempt failed:`, err);
    }
  }

  // Delegate to Puter AI (suppressing verbose trace logs for headless Node environment)
  try {
    return await callPuterAI(options);
  } catch (err) {
    throw new Error('AI Provider unavailable in backend mode. PRISM Static Engine engaged.');
  }
}
