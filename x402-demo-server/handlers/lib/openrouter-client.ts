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
 * Fallback free models to attempt sequentially when credit limit (402) is hit.
 */
export const FREE_FALLBACK_MODELS = [
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-r1:free',
  'qwen/qwen-2.5-72b-instruct:free',
];

/**
 * Executes a single fetch attempt to OpenRouter with a timeout.
 */
async function fetchOpenRouterSingle(
  apiKey: string,
  model: string,
  options: OpenRouterOptions,
  maxTokens?: number,
  isFreeFallback: boolean = false
): Promise<{ status: number; text: string; content?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout per request

  try {
    const bodyPayload: Record<string, any> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
    };

    // Only set max_tokens for paid models or if explicitly provided for free models
    if (maxTokens !== undefined) {
      bodyPayload.max_tokens = maxTokens;
    }

    // Omit response_format for free fallback models to prevent OpenRouter 400/402 payload rejections on free models
    if (options.response_format && !isFreeFallback) {
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
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { status: response.status, text: errorText };
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content;
    return { status: 200, text: '', content: content ?? undefined };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Direct OpenRouter API client to perform chat completion requests.
 * Uses rotation over configured keys, timeout protection, and free model fallback on 402.
 */
export async function callOpenRouter(options: OpenRouterOptions): Promise<string> {
  const keys = getOpenRouterKeys();
  if (keys.length === 0) {
    throw new Error('No OPENROUTER_API_KEY found in environment variables.');
  }

  const model = options.model || process.env.OPENROUTER_MODEL || ACCURATE_MODEL;
  const requestedMaxTokens = options.max_tokens ?? 2500;
  let lastError: Error | null = null;
  let isCreditError = false;

  for (let index = 0; index < keys.length; index++) {
    const apiKey = keys[index];
    try {
      console.log(`[OpenRouter] Sending request to model: ${model} (Key index ${index + 1}/${keys.length})`);
      const result = await fetchOpenRouterSingle(apiKey, model, options, requestedMaxTokens, false);

      if (result.status === 402) {
        console.warn(`[OpenRouter] Key index ${index + 1} HTTP 402 (Insufficient Credits): ${result.text}`);
        isCreditError = true;
        lastError = new Error(`OpenRouter HTTP 402: ${result.text}`);
        break; // Stop testing other keys for paid model if credits are exhausted
      }

      if (result.status !== 200) {
        console.warn(`[OpenRouter] Key index ${index + 1} HTTP ${result.status}: ${result.text}`);
        lastError = new Error(`OpenRouter HTTP ${result.status}: ${result.text}`);
        continue;
      }

      if (!result.content || !result.content.trim()) {
        console.warn(`[OpenRouter] Empty content returned from model ${model}`);
        lastError = new Error(`OpenRouter returned empty message content.`);
        continue;
      }

      return result.content;
    } catch (err: any) {
      console.error(`[OpenRouter] Request failed on ${model} with key index ${index + 1}:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // Fallback path: If credit error or model attempt failed and requested model wasn't already a free model
  if (!model.includes(':free')) {
    console.warn(`[OpenRouter] Primary model ${model} failed (Credit error: ${isCreditError}). Attempting free fallback models...`);
    const apiKey = keys[0];

    for (const freeModel of FREE_FALLBACK_MODELS) {
      try {
        console.log(`[OpenRouter] Attempting free fallback model: ${freeModel}`);
        const freeResult = await fetchOpenRouterSingle(apiKey, freeModel, options, undefined, true);

        if (freeResult.status === 200 && freeResult.content && freeResult.content.trim()) {
          console.log(`[OpenRouter] Free fallback model ${freeModel} succeeded.`);
          return freeResult.content;
        } else {
          console.warn(`[OpenRouter] Free fallback model ${freeModel} status ${freeResult.status}: ${freeResult.text}`);
        }
      } catch (freeErr) {
        console.warn(`[OpenRouter] Free fallback model ${freeModel} failed:`, freeErr);
      }
    }
  }

  throw lastError || new Error('All OpenRouter API attempts failed.');
}

