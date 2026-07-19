import { Schema, model, Types } from 'mongoose';

export interface ITask {
  userId: Types.ObjectId;
  prompt: string;
  category: string;
  plannerOutput?: any;
  selectedEndpoint?: string;
  allCandidateEndpoints?: any;
  endpointChosenReason?: string;

  // --- Dynamic Pricing Fields ---
  /** Price per single execution unit (one file or one call) */
  unitPrice: number;
  /** Number of execution units (files or calls) */
  executionQuantity: number;
  /** Cost for all executions: unitPrice × executionQuantity */
  executionCost: number;
  /** Fixed platform fee added on top of execution cost */
  platformFee: number;
  /** Total cost: executionCost + platformFee */
  totalCost: number;
  /** Human-readable name of the chosen provider */
  providerName: string;
  /** Actual number of times the provider was invoked */
  executionCount: number;

  // --- Transaction Fields ---
  groupTransactionId?: string;
  individualTransactionIds?: string[];
  executionProgressLog?: any[];
  /**
   * Payment mode: 'consolidated' (legacy single tx) or 'grouped' (Algorand atomic group).
   */
  paymentMode?: 'consolidated' | 'grouped';
  /** Algorand block round in which the atomic transaction group was confirmed */
  confirmationRound?: number;
  /** Total number of transactions in the atomic group (N executions + 1 platform fee) */
  atomicGroupSize?: number;

  // --- Legacy / compatibility field ---
  endpointCost?: number;

  verificationScore?: number;
  verificationStatus?: 'passed' | 'failed' | 'unverified';
  executionTime?: number;
  status: 'planned' | 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: any;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  prompt: { type: String, required: true },
  category: { type: String, required: true },
  plannerOutput: { type: Schema.Types.Mixed },
  selectedEndpoint: { type: String },
  allCandidateEndpoints: { type: Schema.Types.Mixed },
  endpointChosenReason: { type: String },

  // Dynamic pricing
  unitPrice: { type: Number, default: 0 },
  executionQuantity: { type: Number, default: 1 },
  executionCost: { type: Number, default: 0 },
  platformFee: { type: Number, default: 0.75 },
  totalCost: { type: Number, default: 0 },
  providerName: { type: String, default: '' },
  executionCount: { type: Number, default: 0 },

  // Transactions
  groupTransactionId: { type: String },
  individualTransactionIds: [{ type: String }],
  executionProgressLog: [{ type: Schema.Types.Mixed }],
  paymentMode: { type: String, enum: ['consolidated', 'grouped'] },
  confirmationRound: { type: Number },
  atomicGroupSize: { type: Number },

  // Legacy
  endpointCost: { type: Number, default: 0 },

  verificationScore: { type: Number, default: 0 },
  verificationStatus: { type: String, enum: ['passed', 'failed', 'unverified'], default: 'unverified' },
  executionTime: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['planned', 'pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
  },
  output: { type: Schema.Types.Mixed },
}, {
  timestamps: true,
});

export const Task = model<ITask>('Task', TaskSchema);
