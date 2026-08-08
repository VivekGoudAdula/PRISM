import { Hono } from 'hono';
import { optionalAuth } from '../middleware/auth';
import { generateDataMap } from '../services/dataMap';
import { DataMap } from '../models/DataMap';
import { User } from '../models/User';
import mongoose from 'mongoose';

const dataMapRouter = new Hono();

dataMapRouter.use('*', optionalAuth);

function generateDataMapTitle(prompt: string, taskType: string): string {
  const pLower = (prompt || '').toLowerCase();
  if (taskType === 'resume_screening' || pLower.includes('resume') || pLower.includes('engineer')) {
    if (pLower.includes('genai') || pLower.includes('gen ai')) return 'GENAI Engineer Recruitment';
    if (pLower.includes('full stack') || pLower.includes('fullstack')) return 'Full Stack Engineer Recruitment';
    if (pLower.includes('ai') || pLower.includes('ml')) return 'AI / ML Engineer Recruitment';
    return 'Candidate Resume Screening';
  }
  if (taskType === 'code_review' || pLower.includes('code') || pLower.includes('repo')) {
    if (pLower.includes('security')) return 'Repository Security Review';
    return 'Codebase Architecture Review';
  }
  if (taskType === 'contract_analysis' || pLower.includes('contract')) {
    return 'Contract Risk Analysis';
  }
  if (taskType === 'invoice_extraction' || pLower.includes('invoice')) {
    return 'Invoice Data Extraction';
  }
  const words = (prompt || 'Task Context').trim().split(/\s+/).slice(0, 4).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * POST /api/data-map/generate
 * Generates an interactive semantic Data Map for a given task/prompt analysis context.
 */
dataMapRouter.post('/generate', async (c) => {
  let requestCategory = 'general_query';
  try {
    const body = await c.req.json().catch(() => ({}));
    const { promptAnalysis = {}, originalPrompt = '', files = [], category, taskId, chatId, executionId } = body;
    if (category) requestCategory = category;

    // Resolve user ID (authenticated token or fallback guest user)
    let userId: any = null;
    const tokenUser = (c as any).get('user');
    if (tokenUser?.userId) {
      const user = await User.findById(tokenUser.userId);
      if (user) userId = user._id;
    }
    if (!userId) {
      let guestUser = await User.findOne({ email: 'guest@prism.ai' });
      if (!guestUser) {
        guestUser = await User.create({
          fullName: 'Guest User',
          email: 'guest@prism.ai',
          passwordHash: 'guest-hashed-pwd',
          role: 'user',
        });
      }
      userId = guestUser._id;
    }

    // Call Data Map generation service
    const generatedMap = await generateDataMap(promptAnalysis, originalPrompt, files, category);

    const generatedTitle = generateDataMapTitle(originalPrompt || promptAnalysis.intent, generatedMap.taskType);

    // Check semantic cache
    const { findSimilarContext, saveContext } = await import('../services/semanticCache');
    const cacheCheck = await findSimilarContext({
      userId,
      chatId,
      taskType: generatedMap.taskType,
      prompt: originalPrompt || promptAnalysis.intent || '',
      files,
    });

    let semanticContextToUse = generatedMap;

    if (cacheCheck.hit && cacheCheck.semanticContext) {
      console.log(`✓ SEMANTIC CACHE HIT (${(cacheCheck.similarity * 100).toFixed(1)}% similarity) - Reusing cached semantic context`);
      // Re-use cached nodes/edges for data graph while preserving generated metadata for prompt intent
      semanticContextToUse = {
        ...generatedMap,
        nodes: cacheCheck.semanticContext.nodes || generatedMap.nodes,
        edges: cacheCheck.semanticContext.edges || generatedMap.edges,
      };
    } else {
      console.log(`⚡ SEMANTIC CACHE MISS - Saving newly generated Data Map representation`);
      // Save semantic context asynchronously
      saveContext({
        userId,
        chatId,
        taskType: generatedMap.taskType,
        prompt: originalPrompt || promptAnalysis.intent || '',
        files,
        semanticContext: generatedMap,
      }).catch(() => {});
    }

    // Build DB record
    const mapData: any = {
      userId,
      chatId: chatId || undefined,
      title: generatedTitle,
      taskType: semanticContextToUse.taskType || generatedMap.taskType,
      rootNodeId: semanticContextToUse.rootNodeId || generatedMap.rootNodeId,
      nodes: semanticContextToUse.nodes || generatedMap.nodes,
      edges: semanticContextToUse.edges || generatedMap.edges,
      metadata: {
        ...generatedMap.metadata,
        cacheHit: cacheCheck.hit,
        cacheSimilarity: cacheCheck.similarity,
        cacheEntryId: cacheCheck.cacheEntryId,
        cachedContextTokens: cacheCheck.cachedContextTokens,
      },
    };

    if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
      mapData.taskId = new mongoose.Types.ObjectId(taskId);
    }
    if (executionId) {
      mapData.executionId = executionId;
    }

    // Persist in MongoDB (reuse existing if chatId or taskId provided)
    let savedDoc = null;
    if (mapData.chatId) {
      savedDoc = await DataMap.findOneAndUpdate(
        { chatId: mapData.chatId },
        mapData,
        { upsert: true, returnDocument: 'after' }
      );
    } else if (mapData.taskId) {
      savedDoc = await DataMap.findOneAndUpdate(
        { taskId: mapData.taskId },
        mapData,
        { upsert: true, returnDocument: 'after' }
      );
    } else {
      savedDoc = await DataMap.create(mapData);
    }

    return c.json({
      id: savedDoc._id.toString(),
      chatId: savedDoc.chatId,
      title: savedDoc.title,
      semanticCache: {
        cacheHit: cacheCheck.hit,
        cacheStatus: cacheCheck.hit ? 'hit' : 'miss',
        similarity: cacheCheck.similarity,
        cachedContextTokens: cacheCheck.cachedContextTokens,
        cacheTokensSaved: cacheCheck.hit ? Math.max(0, (generatedMap.metadata?.estimatedContextTokens || 2000) - cacheCheck.cachedContextTokens) : 0,
        cacheEntryId: cacheCheck.cacheEntryId || '',
      },
      ...generatedMap,
    });
  } catch (error: any) {
    console.error('Error in /api/data-map/generate:', error);
    return c.json(
      {
        error: 'Data Map generation failed',
        message: error.message,
        fallback: true,
        taskType: requestCategory,
        rootNodeId: 'root-fallback',
        nodes: [
          {
            id: 'root-fallback',
            type: 'root',
            label: 'Task Context',
            description: 'Data Map fallback mode active',
            importance: 10,
            tokenEstimate: 200,
            relevanceScore: 1,
            includedInContext: true,
          },
        ],
        edges: [],
        metadata: {
          nodeCount: 1,
          edgeCount: 0,
          relevancePercent: 100,
          estimatedContextTokens: 200,
          potentiallyIrrelevantTokens: 0,
          taskIntent: 'Task execution',
        },
      },
      200
    );
  }
});

/**
 * GET /api/data-map/user
 * Fetches all saved Data Maps for the user.
 */
dataMapRouter.get('/user', async (c) => {
  try {
    let userId: any = null;
    const tokenUser = (c as any).get('user');
    if (tokenUser?.userId) {
      const user = await User.findById(tokenUser.userId);
      if (user) userId = user._id;
    }
    if (!userId) {
      const guestUser = await User.findOne({ email: 'guest@prism.ai' });
      if (guestUser) userId = guestUser._id;
    }

    const maps = await DataMap.find({ userId }).sort({ updatedAt: -1 }).limit(50);
    return c.json(maps);
  } catch (error: any) {
    console.error('Error in GET /api/data-map/user:', error);
    return c.json({ error: 'Failed to fetch user Data Maps' }, 500);
  }
});

/**
 * GET /api/data-map/chat/:chatId
 * Retrieves saved DataMap by chatId.
 */
dataMapRouter.get('/chat/:chatId', async (c) => {
  try {
    const { chatId } = c.req.param();
    const dataMap = await DataMap.findOne({ chatId });
    if (!dataMap) {
      return c.json({ error: 'Data Map not found for this chat' }, 404);
    }
    return c.json(dataMap);
  } catch (error: any) {
    console.error('Error in GET /api/data-map/chat/:chatId:', error);
    return c.json({ error: 'Failed to fetch Data Map' }, 500);
  }
});

/**
 * PATCH /api/data-map/:mapId/title
 * Allows updating/renaming a Data Map title.
 */
dataMapRouter.patch('/:mapId/title', async (c) => {
  try {
    const { mapId } = c.req.param();
    const { title } = await c.req.json();
    if (!title || !title.trim()) {
      return c.json({ error: 'Title is required' }, 400);
    }

    const updated = await DataMap.findByIdAndUpdate(mapId, { title: title.trim() }, { returnDocument: 'after' });
    if (!updated) {
      return c.json({ error: 'Data Map not found' }, 404);
    }
    return c.json(updated);
  } catch (error: any) {
    console.error('Error in PATCH /api/data-map/:mapId/title:', error);
    return c.json({ error: 'Failed to rename Data Map' }, 500);
  }
});

/**
 * GET /api/data-map/task/:taskId
 * Retrieves saved DataMap by taskId.
 */
dataMapRouter.get('/task/:taskId', async (c) => {
  try {
    const { taskId } = c.req.param();
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return c.json({ error: 'Invalid taskId format' }, 400);
    }

    const dataMap = await DataMap.findOne({ taskId: new mongoose.Types.ObjectId(taskId) });
    if (!dataMap) {
      return c.json({ error: 'Data Map not found for this task' }, 404);
    }

    return c.json(dataMap);
  } catch (error: any) {
    console.error('Error in GET /api/data-map/task/:taskId:', error);
    return c.json({ error: 'Failed to fetch Data Map' }, 500);
  }
});

/**
 * GET /api/data-map/:mapId
 * Retrieves saved DataMap by mapId.
 */
dataMapRouter.get('/:mapId', async (c) => {
  try {
    const { mapId } = c.req.param();
    if (!mongoose.Types.ObjectId.isValid(mapId)) {
      return c.json({ error: 'Invalid mapId format' }, 400);
    }

    const dataMap = await DataMap.findById(mapId);
    if (!dataMap) {
      return c.json({ error: 'Data Map not found' }, 404);
    }

    return c.json(dataMap);
  } catch (error: any) {
    console.error('Error in GET /api/data-map/:mapId:', error);
    return c.json({ error: 'Failed to fetch Data Map' }, 500);
  }
});

export default dataMapRouter;
