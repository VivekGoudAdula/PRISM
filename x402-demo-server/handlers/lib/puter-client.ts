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
 * Fast Puter AI client.
 * Performs a single rapid check against Puter AI endpoint without looping through 6 unavailable models.
 */
export async function callPuterAI(options: PuterAIOptions): Promise<string> {
  const model = options.model || 'gpt-4o-mini';
  const prompt = options.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s fast timeout

  try {
    const response = await fetch('https://api.puter.com/v2/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: options.messages,
        prompt,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.max_tokens ?? 2500,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Puter AI HTTP ${response.status}`);
    }

    const data = await response.json();
    let content: string | undefined = undefined;
    if (typeof data === 'string') content = data;
    else if (data.message?.content) content = data.message.content;
    else if (data.choices?.[0]?.message?.content) content = data.choices[0].message.content;

    if (!content || !content.trim()) {
      throw new Error('Puter AI returned empty content');
    }
    return content.trim();
  } finally {
    clearTimeout(timeoutId);
  }
}
