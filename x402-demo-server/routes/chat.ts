import { Hono } from 'hono';
import { Conversation, Message } from '../models/Chat';
import { requireAuth } from '../middleware/auth';
import mongoose from 'mongoose';

const chatRouter = new Hono();

chatRouter.use('*', requireAuth);

/**
 * List conversations
 */
chatRouter.get('/conversations', async (c) => {
  try {
    const user = c.get('user');
    const conversations = await Conversation.find({ userId: user.userId }).sort({ updatedAt: -1 });
    return c.json(conversations);
  } catch (error: any) {
    console.error('Get Conversations Error:', error);
    return c.json({ error: 'Failed to fetch conversations.' }, 500);
  }
});

/**
 * Create conversation
 */
chatRouter.post('/conversations', async (c) => {
  try {
    const user = c.get('user');
    const { title } = await c.req.json().catch(() => ({}));

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return c.json({ error: 'Title is required.' }, 400);
    }

    const conversation = await Conversation.create({
      userId: new mongoose.Types.ObjectId(user.userId),
      title: title.trim(),
    });

    return c.json(conversation, 201);
  } catch (error: any) {
    console.error('Create Conversation Error:', error);
    return c.json({ error: 'Failed to create conversation.' }, 500);
  }
});

/**
 * List messages in a conversation
 */
chatRouter.get('/messages', async (c) => {
  try {
    const conversationId = c.req.query('conversationId');
    if (!conversationId) {
      return c.json({ error: 'conversationId is required.' }, 400);
    }

    // Verify conversation ownership
    const user = c.get('user');
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
 * Add message to a conversation
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

    // Verify ownership
    const user = c.get('user');
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

    // Update conversation updatedAt
    conversation.updatedAt = new Date();
    await conversation.save();

    return c.json(message, 201);
  } catch (error: any) {
    console.error('Save Message Error:', error);
    return c.json({ error: 'Failed to save message.' }, 500);
  }
});

export default chatRouter;
