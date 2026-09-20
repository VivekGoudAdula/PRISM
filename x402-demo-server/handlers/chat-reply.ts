import type { Context } from 'hono';
import { Task } from '../models/Task';
import { callOpenRouter, FAST_MODEL } from './lib/openrouter-client';

/**
 * POST /chat-reply (PUBLIC — free, no payment)
 * Generates a direct, short conversational response using OpenRouter API.
 */
export async function handleChatReplyRequest(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const message = body.message || body.task_description || '';

    if (!message || typeof message !== 'string') {
      return c.json({ reply: "Hello! I'm Prism, your decentralized AI routing assistant. How can I help you today?" });
    }

    const reply = await generateChatReply(message);
    return c.json({
      category: 'conversational',
      reply,
      message: reply,
    });
  } catch (error: any) {
    console.error('Error in chat-reply handler:', error);
    return c.json({
      category: 'conversational',
      reply: "Hello! I'm Prism, your AI routing assistant for resume screening, contract analysis, and invoice extraction.",
      message: "Hello! I'm Prism, your AI routing assistant for resume screening, contract analysis, and invoice extraction.",
    });
  }
}

/**
 * Helper to generate direct OpenRouter LLM response for conversational prompts,
 * grounded in recent task execution context from MongoDB.
 */
export async function generateChatReply(message: string): Promise<string> {
  // 1. Fetch recent task execution context from MongoDB
  let recentTaskContext = '';
  try {
    const recentTasks = await Task.find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    if (recentTasks && recentTasks.length > 0) {
      recentTaskContext = JSON.stringify(
        recentTasks.map((t) => ({
          prompt: t.prompt,
          category: t.category,
          output: t.output,
          totalCost: t.totalCost,
          providerName: t.providerName,
        })),
        null,
        2
      );
    }
  } catch (err) {
    console.error('Error fetching recent tasks for chat reply context:', err);
  }

  // Detect follow-up question intent
  const lowerMsg = message.toLowerCase();
  const isFollowUpQuestion =
    lowerMsg.includes('who') ||
    lowerMsg.includes('best') ||
    lowerMsg.includes('most suitable') ||
    lowerMsg.includes('top candidate') ||
    lowerMsg.includes('highest') ||
    lowerMsg.includes('which candidate') ||
    lowerMsg.includes('result') ||
    lowerMsg.includes('score') ||
    lowerMsg.includes('summary');

  if (isFollowUpQuestion && (!recentTaskContext || recentTaskContext === '[]')) {
    return "I don't have a previous result to reference — could you clarify what you'd like me to look at?";
  }

  const systemPrompt = `You are Prism, an AI routing assistant built on Algorand's x402 payment protocol.

CONTEXT FROM PREVIOUS TASK EXECUTIONS:
${recentTaskContext ? recentTaskContext : 'No prior task executions available.'}

INSTRUCTIONS:
1. Answer the user's question accurately.
2. If answering about past tasks, candidates, contracts, or invoices, use ONLY the provided context data above.
3. Do not invent names, scores, roles, or details not present in the provided context.
4. If the answer isn't in the provided context, state clearly: "I don't have a previous result to reference — could you clarify what you'd like me to look at?"
5. Keep your response concise, clear, and under 3-4 sentences.`;

  try {
    const content = await callOpenRouter({
      model: FAST_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.1,
      max_tokens: 250,
    });

    if (content) return content.trim();
  } catch (err) {
    console.error('Error generating chat reply with OpenRouter:', err);
  }

  // Local fallback response
  if (recentTaskContext && isFollowUpQuestion) {
    return "Based on your recent execution, please check the output details card above for complete candidate scores and candidate names.";
  }
  if (lowerMsg.includes('hi') || lowerMsg.includes('hello') || lowerMsg.includes('hey')) {
    return "Hi there! I'm Prism. You can ask me questions or submit resumes, contracts, or invoices for automated routing and verification.";
  }
  if (lowerMsg.includes('pricing') || lowerMsg.includes('cost') || lowerMsg.includes('fee')) {
    return "Prism charges transparent per-task rates (e.g. $0.20 for fast screening, $0.45 for accurate screening) with on-chain payment verification on Algorand.";
  }
  return "I don't have a previous result to reference — could you clarify what you'd like me to look at?";
}
