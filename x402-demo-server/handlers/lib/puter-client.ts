export const FAST_MODEL = process.env.FAST_MODEL || 'gpt-4o-mini';
export const ACCURATE_MODEL = process.env.ACCURATE_MODEL || 'gpt-4o';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PuterAIOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
}

/**
 * Fallback models supported out-of-the-box by Puter AI.
 */
export const PUTER_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'deepseek-chat',
  'deepseek-reasoner',
  'gpt-5.6-luna',
];

/**
 * Direct Puter AI client to execute AI chat completions via Puter.js AI endpoints.
 * Users don't need to manage or top up API keys/credits.
 */
export async function callPuterAI(options: PuterAIOptions): Promise<string> {
  const model = options.model || process.env.PUTER_MODEL || process.env.OPENROUTER_MODEL || ACCURATE_MODEL;
  
  // Format prompt string or message array for Puter AI driver
  const prompt = options.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout protection

  try {
    console.log(`[PuterAI] Sending request to model: ${model}`);

    // Call Puter AI Chat Completion Endpoint
    const response = await fetch('https://api.puter.com/v2/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: options.messages,
        prompt: prompt,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.max_tokens ?? 2500,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[PuterAI] HTTP ${response.status} from Puter API: ${errText}`);
      
      // Secondary Puter Driver Payload Format Attempt
      const driverRes = await fetch('https://api.puter.com/v2/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interface: 'puter-driver-openai-completion',
          driver: 'openai-completion',
          testMode: false,
          method: 'complete',
          args: {
            model: model,
            messages: options.messages,
            temperature: options.temperature ?? 0.2,
          },
        }),
      });

      if (driverRes.ok) {
        const driverData = await driverRes.json();
        const content = driverData?.message?.content || driverData?.text || driverData?.result;
        if (content && typeof content === 'string') {
          return content.trim();
        }
      }

      throw new Error(`Puter AI returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();

    // Extract text content from Puter AI response formats
    let content: string | undefined = undefined;
    if (typeof data === 'string') {
      content = data;
    } else if (data.message && typeof data.message.content === 'string') {
      content = data.message.content;
    } else if (data.choices?.[0]?.message?.content) {
      content = data.choices[0].message.content;
    } else if (data.text) {
      content = data.text;
    } else if (data.result) {
      content = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
    }

    if (!content || !content.trim()) {
      throw new Error('Puter AI returned empty response content.');
    }

    return content.trim();
  } catch (err: any) {
    console.error(`[PuterAI] Request failed on model ${model}:`, err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
