import { Schema, model, Types } from 'mongoose';

export interface ITask {
  userId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  prompt: string;
  category: string;
  plannerOutput?: any;
  selectedEndpoint?: string;
  allCandidateEndpoints?: any;
  endpointChosenReason?: string;

  // Context & Summary fields
  resultSummary?: string;
  references?: string[];

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
  /** Per-item pricing breakdown for batch executions */
  itemPrices?: Array<any>;
  baseTotal?: number;
  totalOptimizationDiscount?: number;
  finalTotal?: number;
  averageFinalPrice?: number;

  // --- Transaction Fields ---
  groupTransactionId?: string;
  individualTransactionIds?: string[];
  executionProgressLog?: any[];
  paymentMode?: string;

  // --- Legacy / compatibility field ---
  endpointCost?: number;

  verificationScore?: number;
  verificationStatus?: 'passed' | 'failed' | 'unverified';
  refundIssued?: boolean;
  refundTxId?: string;
  refundAmount?: number;
  executionTime?: number;
  status: 'planned' | 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: any;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
  prompt: { type: String, required: true },
  category: { type: String, required: true, index: true },
  plannerOutput: { type: Schema.Types.Mixed },
  selectedEndpoint: { type: String },
  allCandidateEndpoints: { type: Schema.Types.Mixed },
  endpointChosenReason: { type: String },

  resultSummary: { type: String },
  references: [{ type: String }],

  // Dynamic pricing
  unitPrice: { type: Number, default: 0 },
  executionQuantity: { type: Number, default: 1 },
  executionCost: { type: Number, default: 0 },
  platformFee: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  providerName: { type: String, default: '' },
  executionCount: { type: Number, default: 0 },
  itemPrices: [{ type: Schema.Types.Mixed }],
  baseTotal: { type: Number },
  totalOptimizationDiscount: { type: Number },
  finalTotal: { type: Number },
  averageFinalPrice: { type: Number },

  // Transactions
  groupTransactionId: { type: String },
  individualTransactionIds: [{ type: String }],
  executionProgressLog: [{ type: Schema.Types.Mixed }],
  paymentMode: { type: String },

  // Legacy
  endpointCost: { type: Number, default: 0 },

  verificationScore: { type: Number, default: 0 },
  verificationStatus: { type: String, enum: ['passed', 'failed', 'unverified'], default: 'unverified' },
  refundIssued: { type: Boolean, default: false },
  refundTxId: { type: String },
  refundAmount: { type: Number, default: 0 },
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
