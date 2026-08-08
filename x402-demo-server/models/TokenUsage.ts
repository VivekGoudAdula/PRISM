import { Schema, model, Types } from 'mongoose';

export type MeasurementSource = 'provider_usage' | 'estimated' | 'hybrid';

export interface ITokenUsage {
  userId: Types.ObjectId;
  taskId: Types.ObjectId;
  executionId: string;

  endpointId: string;
  endpointPath?: string;
  providerName?: string;

  originalInputTokens: number;
  optimizedInputTokens: number;
  outputTokens: number;
  totalTokens: number;

  estimatedOriginalCost: number;
  optimizedCost: number;

  tokensSaved: number;
  costSaved: number;
  compressionRatio: number;

  cacheHit: boolean;
  cacheStatus?: 'hit' | 'miss' | 'bypass';
  cachedContextTokens?: number;
  cacheTokensSaved: number;
  cacheSimilarity?: number;
  cacheEntryId?: string;

  measurementSource: MeasurementSource;
  costSource?: string;

  inputTokenPrice: number;
  outputTokenPrice: number;

  currency: string;

  createdAt: Date;
  updatedAt: Date;
}

const TokenUsageSchema = new Schema<ITokenUsage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    executionId: { type: String, required: true, unique: true, index: true },

    endpointId: { type: String, required: true, index: true },
    endpointPath: { type: String, default: '' },
    providerName: { type: String, default: '' },

    originalInputTokens: { type: Number, default: 0 },
    optimizedInputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },

    estimatedOriginalCost: { type: Number, default: 0 },
    optimizedCost: { type: Number, default: 0 },

    tokensSaved: { type: Number, default: 0 },
    costSaved: { type: Number, default: 0 },
    compressionRatio: { type: Number, default: 0 },

    cacheHit: { type: Boolean, default: false },
    cacheStatus: { type: String, enum: ['hit', 'miss', 'bypass'], default: 'miss' },
    cachedContextTokens: { type: Number, default: 0 },
    cacheTokensSaved: { type: Number, default: 0 },
    cacheSimilarity: { type: Number, default: 0 },
    cacheEntryId: { type: String, default: '' },

    measurementSource: {
      type: String,
      enum: ['provider_usage', 'estimated', 'hybrid'],
      default: 'estimated',
    },
    costSource: { type: String, default: 'standard_model_pricing' },

    inputTokenPrice: { type: Number, default: 0 },
    outputTokenPrice: { type: Number, default: 0 },

    currency: { type: String, default: 'USD' },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for aggregations
TokenUsageSchema.index({ userId: 1, createdAt: -1 });
TokenUsageSchema.index({ createdAt: -1 });

export const TokenUsage = model<ITokenUsage>('TokenUsage', TokenUsageSchema);
