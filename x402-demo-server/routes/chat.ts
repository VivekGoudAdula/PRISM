import { Hono } from 'hono';
import { Conversation, Message } from '../models/Chat';
import { requireAuth } from '../middleware/auth';
import mongoose from 'mongoose';

const chatRouter = new Hono();

chatRouter.use('*', requireAuth);

/**
 * List conversations, sorted newest first.
 * Includes the thread array so the frontend can restore full chat history.
 */
chatRouter.get('/conversations', async (c) => {
  try {
    const user = (c as any).get('user');
    const conversations = await Conversation.find({ userId: user.userId }).sort({ updatedAt: -1 });
    return c.json(conversations);
  } catch (error: any) {
    console.error('Get Conversations Error:', error);
    return c.json({ error: 'Failed to fetch conversations.' }, 500);
  }
});

/**
 * Create a new conversation.
 * Body: { title: string, thread?: any[] }
 */
chatRouter.post('/conversations', async (c) => {
  try {
    const user = (c as any).get('user');
    const { title, thread = [] } = await c.req.json().catch(() => ({}));

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return c.json({ error: 'Title is required.' }, 400);
    }

    const conversation = await Conversation.create({
      userId: new mongoose.Types.ObjectId(user.userId),
      title: title.trim(),
      thread,
    });

    return c.json(conversation, 201);
  } catch (error: any) {
    console.error('Create Conversation Error:', error);
    return c.json({ error: 'Failed to create conversation.' }, 500);
  }
});

/**
 * Save (overwrite) the full thread for an existing conversation.
 * Body: { thread: any[] }
 */
chatRouter.put('/conversations/:id/thread', async (c) => {
  try {
    const user = (c as any).get('user');
    const { id } = c.req.param();
    const { thread } = await c.req.json().catch(() => ({}));

    if (!Array.isArray(thread)) {
      return c.json({ error: 'thread must be an array.' }, 400);
    }

    // Guard: only query MongoDB if the ID looks like a valid ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return c.json({ error: 'Invalid conversation ID format.' }, 400);
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { thread, updatedAt: new Date() },
      { new: true },
    );

    if (!conversation) {
      return c.json({ error: 'Conversation not found or unauthorized.' }, 404);
    }

    return c.json(conversation);
  } catch (error: any) {
    console.error('Save Thread Error:', error);
    return c.json({ error: 'Failed to save thread.' }, 500);
  }
});

/**
 * Get the full thread of a conversation.
 */
chatRouter.get('/conversations/:id/thread', async (c) => {
  try {
    const user = (c as any).get('user');
    const { id } = c.req.param();

    // Guard: only query MongoDB if the ID looks like a valid ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return c.json({ thread: [] });
    }

    const conversation = await Conversation.findOne({ _id: id, userId: user.userId });
    if (!conversation) {
      return c.json({ error: 'Conversation not found or unauthorized.' }, 404);
    }

    return c.json({ thread: conversation.thread || [] });
  } catch (error: any) {
    console.error('Get Thread Error:', error);
    return c.json({ error: 'Failed to fetch thread.' }, 500);
  }
});

/**
 * List messages in a conversation (legacy text messages)
 */
chatRouter.get('/messages', async (c) => {
  try {
    const conversationId = c.req.query('conversationId');
    if (!conversationId) {
      return c.json({ error: 'conversationId is required.' }, 400);
    }

    const user = (c as any).get('user');
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: user.userId
    });

    if (!conversation) {
      return c.json({ error: 'Conversation not found or unauthorized.' }, 404);
    }

    const messages = await Message.find({ conversationId }).sort({ timestamp: 1 });
    return c.json(messages);
  } catch (error: any) {
    console.error('Get Messages Error:', error);
    return c.json({ error: 'Failed to fetch messages.' }, 500);
  }
});

/**
 * Add a message to a conversation (legacy text messages)
 */
chatRouter.post('/messages', async (c) => {
  try {
    const { conversationId, role, content } = await c.req.json().catch(() => ({}));

    if (!conversationId || !role || !content) {
      return c.json({ error: 'conversationId, role, and content are required.' }, 400);
    }

    if (role !== 'user' && role !== 'assistant') {
      return c.json({ error: 'Invalid role. Must be user or assistant.' }, 400);
    }

    const user = (c as any).get('user');
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: user.userId
    });

    if (!conversation) {
      return c.json({ error: 'Conversation not found or unauthorized.' }, 404);
    }

    const message = await Message.create({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      role,
      content,
    });

    conversation.updatedAt = new Date();
    await conversation.save();

    return c.json(message, 201);
  } catch (error: any) {
    console.error('Save Message Error:', error);
    return c.json({ error: 'Failed to save message.' }, 500);
  }
});

export default chatRouter;
