import { Schema, model, Types } from 'mongoose';

export interface ISemanticCache {
  userId: Types.ObjectId;
  workspaceId?: string;
  chatId?: string;
  taskType: string;
  normalizedQuery: string;
  embedding?: number[];
  semanticContext: any;
  sourceMapId?: Types.ObjectId;
  sourceFingerprint: string;
  tokenEstimate: number;
  hitCount: number;
  lastUsedAt: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SemanticCacheSchema = new Schema<ISemanticCache>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspaceId: { type: String, index: true },
    chatId: { type: String, index: true },
    taskType: { type: String, required: true, index: true },
    normalizedQuery: { type: String, required: true },
    embedding: { type: [Number], select: false },
    semanticContext: { type: Schema.Types.Mixed, required: true },
    sourceMapId: { type: Schema.Types.ObjectId, ref: 'DataMap' },
    sourceFingerprint: { type: String, required: true, index: true },
    tokenEstimate: { type: Number, default: 0 },
    hitCount: { type: Number, default: 1 },
    lastUsedAt: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for high performance cache lookups
SemanticCacheSchema.index({ userId: 1, taskType: 1, sourceFingerprint: 1 });
SemanticCacheSchema.index({ userId: 1, lastUsedAt: -1 });

export const SemanticCache = model<ISemanticCache>('SemanticCache', SemanticCacheSchema);
