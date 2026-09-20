import type { Context } from 'hono';
import { processConversationalMessage } from '../services/conversational-router';

/**
 * POST /chat-reply (PUBLIC — free, no payment)
 * Generates a direct, context-aware response using multi-task conversational router.
 */
export async function handleChatReplyRequest(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const message = body.message || body.task_description || '';
    const conversationId = body.conversationId || body.conversation_id;

    if (!message || typeof message !== 'string') {
      return c.json({
        category: 'conversational',
        intent: 'CONVERSATIONAL',
        reply: "Hello! I'm Prism, your multi-task AI workspace assistant. How can I help you today?",
        message: "Hello! I'm Prism, your multi-task AI workspace assistant. How can I help you today?",
      });
    }

    const routeResult = await processConversationalMessage({
      conversationId,
      message,
    });

    return c.json({
      category: routeResult.intent.toLowerCase(),
      intent: routeResult.intent,
      activeTaskId: routeResult.activeTaskId,
      referencedTaskIds: routeResult.referencedTaskIds,
      isAmbiguous: routeResult.isAmbiguous,
      clarificationQuestion: routeResult.clarificationQuestion,
      reply: routeResult.message,
      message: routeResult.message,
      source: routeResult.source,
    });
  } catch (error: any) {
    console.error('Error in chat-reply handler:', error);
    return c.json({
      category: 'conversational',
      intent: 'CONVERSATIONAL',
      reply: "Hello! I'm Prism, your AI assistant. You can perform repository reviews, resume screening, contract analysis, and invoice extraction in this conversation.",
      message: "Hello! I'm Prism, your AI assistant. You can perform repository reviews, resume screening, contract analysis, and invoice extraction in this conversation.",
    });
  }
}

/**
 * Helper to generate direct response for conversational prompts.
 */
export async function generateChatReply(message: string, conversationId?: string): Promise<string> {
  const res = await processConversationalMessage({ conversationId, message });
  return res.message;
}
