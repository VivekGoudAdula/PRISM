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
   * 'consolidated' = legacy single tx for total.
   * 'grouped'      = true Algorand atomic transaction group.
   */
  paymentMode?: 'consolidated' | 'grouped';
  /**
   * Individual per-execution and platform-fee transaction IDs
   * from the confirmed Algorand atomic group.
   */
  transactionIds?: string[];
  /** Algorand block round in which the atomic group confirmed */
  confirmationRound?: number;
  /** Total number of transactions in the atomic group (N executions + 1 platform fee) */
  atomicGroupSize?: number;

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
  paymentMode: { type: String, enum: ['consolidated', 'grouped'], default: 'grouped' },
  transactionIds: { type: [String], default: undefined },
  confirmationRound: { type: Number },
  atomicGroupSize: { type: Number },

  currency: { type: String, default: 'USDC' },
  blockchain: { type: String, default: 'Algorand' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
}, {
  timestamps: true,
});

export const Payments = model<IPayment>('Payments', PaymentsSchema);
