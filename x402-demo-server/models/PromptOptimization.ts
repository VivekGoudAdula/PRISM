import mongoose, { Schema, Document } from 'mongoose';

export interface IPromptOptimization extends Document {
  userId: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  executionId?: string;
  originalInputTokens: number;
  optimizedInputTokens: number;
  tokensSaved: number;
  reductionPercentage: number;
  compressionRatio: number;
  cacheHit: boolean;
  cacheTokensSaved: number;
  optimizerTokensSaved: number;
  totalTokensSaved: number;
  preservedEntities: string[];
  preservedRelationships: string[];
  preservedConstraints: string[];
  removedRedundancies: string[];
  removedIrrelevantContext: string[];
  summarizedSections: string[];
  optimizationApplied: boolean;
  modelUsed: string;
  measurementSource: 'provider_usage' | 'estimated' | 'hybrid';
  createdAt: Date;
}

const PromptOptimizationSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', index: true },
    executionId: { type: String, index: true },
    originalInputTokens: { type: Number, required: true, default: 0 },
    optimizedInputTokens: { type: Number, required: true, default: 0 },
    tokensSaved: { type: Number, required: true, default: 0 },
    reductionPercentage: { type: Number, required: true, default: 0 },
    compressionRatio: { type: Number, required: true, default: 0 },
    cacheHit: { type: Boolean, default: false },
    cacheTokensSaved: { type: Number, default: 0 },
    optimizerTokensSaved: { type: Number, default: 0 },
    totalTokensSaved: { type: Number, default: 0 },
    preservedEntities: { type: [String], default: [] },
    preservedRelationships: { type: [String], default: [] },
    preservedConstraints: { type: [String], default: [] },
    removedRedundancies: { type: [String], default: [] },
    removedIrrelevantContext: { type: [String], default: [] },
    summarizedSections: { type: [String], default: [] },
    optimizationApplied: { type: Boolean, default: true },
    modelUsed: { type: String, default: 'deterministic-hybrid' },
    measurementSource: { type: String, enum: ['provider_usage', 'estimated', 'hybrid'], default: 'estimated' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

PromptOptimizationSchema.index({ userId: 1, createdAt: -1 });
PromptOptimizationSchema.index({ taskId: 1, createdAt: -1 });

export const PromptOptimization = mongoose.model<IPromptOptimization>(
  'PromptOptimization',
  PromptOptimizationSchema
);
