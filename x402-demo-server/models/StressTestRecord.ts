import { Schema, model } from 'mongoose';

export interface IStressTestRecord {
  testId: string;
  repositoryId?: string;
  taskCategory: string;
  endpoint: string;
  filesDiscovered: number;
  filesProcessed: number;
  filesSkipped: number;
  successfulCount: number;
  failedCount: number;
  transactionCount: number;
  totalCost: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  originalTokens: number;
  optimizedTokens: number;
  tokensSaved: number;
  tokenReductionPercent: number;
  verificationSuccessRate: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StressTestRecordSchema = new Schema<IStressTestRecord>({
  testId: { type: String, required: true, unique: true, index: true },
  repositoryId: { type: String, default: '' },
  taskCategory: { type: String, required: true, index: true },
  endpoint: { type: String, required: true },
  filesDiscovered: { type: Number, default: 0 },
  filesProcessed: { type: Number, default: 0 },
  filesSkipped: { type: Number, default: 0 },
  successfulCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  transactionCount: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  avgLatencyMs: { type: Number, default: 0 },
  p95LatencyMs: { type: Number, default: 0 },
  originalTokens: { type: Number, default: 0 },
  optimizedTokens: { type: Number, default: 0 },
  tokensSaved: { type: Number, default: 0 },
  tokenReductionPercent: { type: Number, default: 0 },
  verificationSuccessRate: { type: Number, default: 100 },
  notes: { type: String, default: '' },
}, {
  timestamps: true,
});

export const StressTestRecord = model<IStressTestRecord>('StressTestRecord', StressTestRecordSchema);
