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
 * Resolves available OpenRouter API keys from environment variables.
 * Checks OPENROUTER_API_KEY, OPENROUTER_API_KEY_1..10.
 */
export function getOpenRouterKeys(): string[] {
  const keys: string[] = [];

  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) {
    keys.push(process.env.OPENROUTER_API_KEY.trim());
  }

  for (let i = 1; i <= 10; i++) {
    const k = process.env[`OPENROUTER_API_KEY_${i}`];
    if (k && k.trim() && !keys.includes(k.trim())) {
      keys.push(k.trim());
    }
  }

  return keys;
}

/**
 * Direct OpenRouter API client to perform chat completion requests.
 * Uses rotation over configured keys and standard OpenRouter headers.
 */
export async function callOpenRouter(options: OpenRouterOptions): Promise<string> {
  const keys = getOpenRouterKeys();
  if (keys.length === 0) {
    throw new Error('No OPENROUTER_API_KEY found in environment variables.');
  }

  const model = options.model || process.env.OPENROUTER_MODEL || ACCURATE_MODEL;
  let lastError: Error | null = null;

  for (let index = 0; index < keys.length; index++) {
    const apiKey = keys[index];
    try {
      console.log(`[OpenRouter] Sending request to model: ${model} (Key index ${index + 1}/${keys.length})`);

      // Set a reasonable default max_tokens (e.g., 2500) if unspecified to prevent OpenRouter from reserving 65,536 max tokens on low-credit balances.
      const bodyPayload: Record<string, any> = {
        model,
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

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[OpenRouter] Key index ${index + 1} HTTP ${response.status}: ${errorText}`);
        lastError = new Error(`OpenRouter HTTP ${response.status}: ${errorText}`);

        // Handle credit limits / 402: try lower max_tokens first, then fall back to an active free model
        if (response.status === 402) {
          const currentMaxTokens = bodyPayload.max_tokens || 2500;
          if (currentMaxTokens > 1200) {
            console.warn(`[OpenRouter] HTTP 402 on ${model}, retrying with lower max_tokens (1200)...`);
            return await callOpenRouter({ ...options, model, max_tokens: 1200 });
          } else if (!model.includes(':free')) {
            const freeFallbackModel = 'nvidia/nemotron-3.5-lightning:free';
            console.warn(`[OpenRouter] HTTP 402 on ${model}, attempting free fallback to ${freeFallbackModel}...`);
            return await callOpenRouter({ ...options, model: freeFallbackModel, max_tokens: 1200 });
          }
        }
        continue;
      }

      const data = (await response.json()) as OpenRouterResponse;
      const content = data.choices?.[0]?.message?.content;

      if (content === undefined || content === null) {
        console.warn(`[OpenRouter] Empty content returned from model ${model}`);
        lastError = new Error(`OpenRouter returned empty message content.`);
        continue;
      }

      return content;
    } catch (err: any) {
      console.error(`[OpenRouter] Request failed with key index ${index + 1}:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('All OpenRouter API attempts failed.');
}
