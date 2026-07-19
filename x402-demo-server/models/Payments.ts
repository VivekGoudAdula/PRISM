import { Schema, model, Types } from 'mongoose';

export interface IPayment {
  taskId: Types.ObjectId;
  userId: Types.ObjectId;
  x402TransactionId: string;

  // --- Dynamic Pricing Breakdown ---
  /** Price per single execution unit */
  unitPrice: number;
  /** Number of execution units */
  executionQuantity: number;
  /** Total cost for all executions: unitPrice × executionQuantity */
  executionCost: number;
  /** Fixed platform fee */
  platformFee: number;
  /** Final total: executionCost + platformFee (what was paid via x402) */
  totalAmount: number;

  // --- Legacy / compatibility ---
  /** Total amount paid (alias for totalAmount, kept for backward compat) */
  amount: number;

  // --- Grouped Payment Tracking ---
  /**
   * The consolidated x402 transaction signature covering the entire batch.
   * Mirrors Task.groupTransactionId for cross-collection lookups.
   */
  groupTransactionId?: string;
  /**
   * Which payment mode was used.
   * 'consolidated' = single tx for total (current).
   * 'grouped'      = true Algorand atomic group (future).
   */
  paymentMode?: 'consolidated' | 'grouped';
  /**
   * Reserved for future true grouped-txn support.
   * Will store individual per-execution transaction IDs.
   */
  transactionIds?: string[];

  currency: string;
  blockchain: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const PaymentsSchema = new Schema<IPayment>({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  x402TransactionId: { type: String, required: true, unique: true, index: true },

  // Dynamic pricing breakdown
  unitPrice: { type: Number, default: 0 },
  executionQuantity: { type: Number, default: 1 },
  executionCost: { type: Number, default: 0 },
  platformFee: { type: Number, default: 0.75 },
  totalAmount: { type: Number, default: 0 },

  // Legacy
  amount: { type: Number, required: true },

  // Grouped payment tracking
  groupTransactionId: { type: String, index: true },
  paymentMode: { type: String, enum: ['consolidated', 'grouped'], default: 'consolidated' },
  transactionIds: { type: [String], default: undefined },

  currency: { type: String, default: 'USDC' },
  blockchain: { type: String, default: 'Algorand' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
}, {
  timestamps: true,
});

export const Payments = model<IPayment>('Payments', PaymentsSchema);
