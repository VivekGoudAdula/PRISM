import crypto from 'crypto';
import mongoose from 'mongoose';
import { SemanticCache, ISemanticCache } from '../models/SemanticCache';
import { estimateTokens } from './tokenAnalytics';
import { isEncrypted, decryptDocument } from './encryption';

/**
 * Normalizes query string for semantic matching.
 */
export function normalizeQuery(query: string): string {
  if (!query || typeof query !== 'string') return '';
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Creates a unique fingerprint of the source inputs (prompt + source file contents).
 * Transparently decrypts encrypted file contents to ensure canonical, deterministic hashing
 * across plans and execution steps regardless of random encryption IVs.
 */
export function createContextFingerprint(prompt: string, files: any[] = []): string {
  const normPrompt = normalizeQuery(prompt);
  const fileDigest = (files || [])
    .map((f) => {
      const name = f.filename || f.path || f.file_path || f.name || '';
      const rawText = f.text || f.extracted_text || f.content_base64 || f.raw_url || f.content || '';
      // Canonicalize: if the text is AES-256-GCM encrypted, decrypt to original content for deterministic digest
      const text = isEncrypted(rawText) ? decryptDocument(rawText) : rawText;
      const contentHash = crypto.createHash('sha256').update(text).digest('hex');
      return `${name}:${contentHash}`;
    })
    .sort()
    .join('|');

  const combined = `${normPrompt}#FILES:${fileDigest}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

/**
 * Basic word-based vector representation (TF-IDF style) for fallback embedding/similarity.
 * Supports upgrade via process.env.EMBEDDING_API_KEY / Groq / OpenAI embeddings if configured.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const normalized = normalizeQuery(text);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return new Array(128).fill(0);

  // Deterministic 128-dimensional frequency hash vector
  const dim = 128;
  const vector = new Array(dim).fill(0);

  for (const word of words) {
    const hash = crypto.createHash('md5').update(word).digest();
    const idx = hash[0] % dim;
    const val = (hash[1] / 255.0) * 2 - 1;
    vector[idx] += val;
  }

  // Normalize L2 magnitude
  const mag = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (mag > 0) {
    for (let i = 0; i < dim; i++) {
      vector[i] = parseFloat((vector[i] / mag).toFixed(6));
    }
  }

  return vector;
}

/**
 * Calculates Cosine Similarity between two vector embeddings.
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return Math.min(1.0, Math.max(0.0, dot / denominator));
}

export interface CheckCacheOptions {
  userId: string | mongoose.Types.ObjectId;
  workspaceId?: string;
  chatId?: string;
  taskType: string;
  prompt: string;
  files?: any[];
  threshold?: number;
}

export interface CacheCheckResult {
  hit: boolean;
  similarity: number;
  cachedContextTokens: number;
  cacheEntryId?: string;
  semanticContext?: any;
  sourceMapId?: string;
  sourceFingerprint: string;
}

/**
 * Checks for a semantic cache hit strictly within the authenticated user's workspace/context.
 * Guarantees zero cross-user cache leakage.
 */
export async function findSimilarContext(options: CheckCacheOptions): Promise<CacheCheckResult> {
  const threshold = options.threshold || parseFloat(process.env.SEMANTIC_CACHE_THRESHOLD || '0.85');

  // Strict tenant & user isolation: require a valid MongoDB ObjectId
  if (!options.userId || !mongoose.Types.ObjectId.isValid(options.userId.toString())) {
    return {
      hit: false,
      similarity: 0,
      cachedContextTokens: 0,
      sourceFingerprint: '',
    };
  }

  const userId = new mongoose.Types.ObjectId(options.userId);
  const sourceFingerprint = createContextFingerprint(options.prompt, options.files);

  const queryFilter: any = {
    userId,
    taskType: options.taskType,
    sourceFingerprint,
  };

  // Optional workspace-level tenancy isolation
  if (options.workspaceId) {
    queryFilter.workspaceId = options.workspaceId;
  }

  // Require exact sourceFingerprint & prompt match to avoid returning cached context on changed documents
  const query = SemanticCache.findOne(queryFilter);
  const exactMatch = query && typeof query.select === 'function'
    ? await query.select('+embedding')
    : await query;

  if (exactMatch) {
    exactMatch.hitCount += 1;
    exactMatch.lastUsedAt = new Date();
    if (typeof exactMatch.save === 'function') {
      await exactMatch.save().catch(() => {});
    }

    return {
      hit: true,
      similarity: 1.0,
      cachedContextTokens: exactMatch.tokenEstimate,
      cacheEntryId: exactMatch._id.toString(),
      semanticContext: exactMatch.semanticContext,
      sourceMapId: exactMatch.sourceMapId?.toString(),
      sourceFingerprint,
    };
  }

  return {
    hit: false,
    similarity: 0,
    cachedContextTokens: 0,
    sourceFingerprint,
  };
}

export interface SaveCacheOptions {
  userId: string | mongoose.Types.ObjectId;
  workspaceId?: string;
  chatId?: string;
  taskType: string;
  prompt: string;
  files?: any[];
  semanticContext: any;
  sourceMapId?: string | mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
}

/**
 * Saves a new semantic context representation to MongoDB (non-blocking safe).
 * Strictly bound to requesting user.
 */
export async function saveContext(options: SaveCacheOptions): Promise<any> {
  try {
    if (!options.userId || !mongoose.Types.ObjectId.isValid(options.userId.toString())) {
      console.warn('[SEMANTIC CACHE] Rejected saveContext: missing or invalid userId');
      return null;
    }

    const userId = new mongoose.Types.ObjectId(options.userId);
    const normQuery = normalizeQuery(options.prompt);
    const sourceFingerprint = createContextFingerprint(options.prompt, options.files);
    const embedding = await generateEmbedding(normQuery);

    const serializedContext = JSON.stringify(options.semanticContext || {});
    const tokenEstimate = estimateTokens(serializedContext);

    const docData: any = {
      userId,
      workspaceId: options.workspaceId,
      chatId: options.chatId,
      taskType: options.taskType,
      normalizedQuery: normQuery,
      embedding,
      semanticContext: options.semanticContext,
      sourceFingerprint,
      tokenEstimate,
      lastUsedAt: new Date(),
      metadata: options.metadata || {},
    };

    if (options.sourceMapId && mongoose.Types.ObjectId.isValid(options.sourceMapId)) {
      docData.sourceMapId = new mongoose.Types.ObjectId(options.sourceMapId);
    }

    const savedDoc = await SemanticCache.findOneAndUpdate(
      { userId, taskType: options.taskType, sourceFingerprint },
      docData,
      { upsert: true, returnDocument: 'after' }
    );

    return savedDoc;
  } catch (err: any) {
    console.error('Error saving Semantic Cache context (non-blocking):', err?.message || err);
    return null;
  }
}

/**
 * Invalidates a specific cached context when source documents or prompts are modified.
 */
export async function invalidateContext(
  userId: string | mongoose.Types.ObjectId,
  taskType: string,
  sourceFingerprint: string
): Promise<boolean> {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) return false;
  const result = await SemanticCache.deleteOne({
    userId: new mongoose.Types.ObjectId(userId),
    taskType,
    sourceFingerprint,
  });
  return (result.deletedCount || 0) > 0;
}

/**
 * Invalidates all semantic cache entries for a specific user (e.g. on account reset or request).
 */
export async function invalidateUserCache(userId: string | mongoose.Types.ObjectId): Promise<number> {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) return 0;
  const result = await SemanticCache.deleteMany({
    userId: new mongoose.Types.ObjectId(userId),
  });
  return result.deletedCount || 0;
}

/**
 * Invalidates all semantic cache entries linked to a specific source DataMap.
 */
export async function invalidateMapCache(sourceMapId: string | mongoose.Types.ObjectId): Promise<number> {
  if (!sourceMapId || !mongoose.Types.ObjectId.isValid(sourceMapId.toString())) return 0;
  const result = await SemanticCache.deleteMany({
    sourceMapId: new mongoose.Types.ObjectId(sourceMapId),
  });
  return result.deletedCount || 0;
}
