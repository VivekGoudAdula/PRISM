import { Schema, model, Types } from 'mongoose';

export interface IPromptAnalysis {
  userId: Types.ObjectId;
  taskId?: Types.ObjectId;
  executionId?: string;
  originalPrompt: string;
  score: number;
  intent: string;
  taskType: string;
  issues: string[];
  requiredInformation: string[];
  irrelevantInformation: string[];
  constraints: string[];
  suggestions: string[];
  improvedPrompt: string;
  modelUsed?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PromptAnalysisSchema = new Schema<IPromptAnalysis>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', index: true },
    executionId: { type: String },
    originalPrompt: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    intent: { type: String, required: true },
    taskType: { type: String, required: true },
    issues: [{ type: String }],
    requiredInformation: [{ type: String }],
    irrelevantInformation: [{ type: String }],
    constraints: [{ type: String }],
    suggestions: [{ type: String }],
    improvedPrompt: { type: String, required: true },
    modelUsed: { type: String, default: 'llama-3.3-70b-versatile' },
  },
  {
    timestamps: true,
  }
);

PromptAnalysisSchema.index({ userId: 1, createdAt: -1 });
PromptAnalysisSchema.index({ createdAt: -1 });

export const PromptAnalysis = model<IPromptAnalysis>('PromptAnalysis', PromptAnalysisSchema);
