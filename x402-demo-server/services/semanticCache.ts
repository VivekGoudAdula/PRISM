import crypto from 'crypto';
import mongoose from 'mongoose';
import { SemanticCache, ISemanticCache } from '../models/SemanticCache';
import { estimateTokens } from './tokenAnalytics';

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
 */
export function createContextFingerprint(prompt: string, files: any[] = []): string {
  const normPrompt = normalizeQuery(prompt);
  const fileDigest = (files || [])
    .map((f) => {
      const name = f.filename || f.path || f.file_path || f.name || '';
      const text = f.text || f.extracted_text || f.content_base64 || f.raw_url || f.content || '';
      // Include deterministic hash of the actual file text content
      const contentHash = crypto.createHash('md5').update(text).digest('hex');
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
 */
export async function findSimilarContext(options: CheckCacheOptions): Promise<CacheCheckResult> {
  const threshold = options.threshold || parseFloat(process.env.SEMANTIC_CACHE_THRESHOLD || '0.85');
  const userId = new mongoose.Types.ObjectId(options.userId);
  const normQuery = normalizeQuery(options.prompt);
  const sourceFingerprint = createContextFingerprint(options.prompt, options.files);

  // Require exact sourceFingerprint & prompt match to avoid returning cached full-site context on partial item runs
  const exactMatch = await SemanticCache.findOne({
    userId,
    taskType: options.taskType,
    sourceFingerprint,
  }).select('+embedding');

  if (exactMatch) {
    exactMatch.hitCount += 1;
    exactMatch.lastUsedAt = new Date();
    await exactMatch.save().catch(() => {});

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
 */
export async function saveContext(options: SaveCacheOptions): Promise<any> {
  try {
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
