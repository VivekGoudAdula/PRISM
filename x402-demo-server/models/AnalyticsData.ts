import { Schema, model } from 'mongoose';

export interface IRefund {
  taskId?: Schema.Types.ObjectId;
  originalAmount: number;
  refundAmount: number;
  refundTxId: string;
  reason: string;
  timestamp: Date;
}

const RefundSchema = new Schema<IRefund>({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
  originalAmount: { type: Number, required: true },
  refundAmount: { type: Number, required: true },
  refundTxId: { type: String, required: true },
  reason: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export const Refund = model<IRefund>('Refund', RefundSchema);

export interface IReputation {
  endpointPath: string;
  score: number;
  totalRuns: number;
  verifiedPasses: number;
}

const ReputationSchema = new Schema<IReputation>({
  endpointPath: { type: String, required: true, unique: true, index: true },
  score: { type: Number, default: 0.5 },
  totalRuns: { type: Number, default: 0 },
  verifiedPasses: { type: Number, default: 0 }
}, { timestamps: true });

export const Reputation = model<IReputation>('Reputation', ReputationSchema);

export interface ISavingsLog {
  filename: string;
  rawTokens: number;
  mapTokens: number;
  tokensSaved: number;
  reductionPercent: number;
  timestamp: Date;
}

const SavingsLogSchema = new Schema<ISavingsLog>({
  filename: { type: String, required: true },
  rawTokens: { type: Number, required: true },
  mapTokens: { type: Number, required: true },
  tokensSaved: { type: Number, required: true },
  reductionPercent: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export const SavingsLog = model<ISavingsLog>('SavingsLog', SavingsLogSchema);


