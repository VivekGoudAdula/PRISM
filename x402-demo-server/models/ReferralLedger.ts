import { Schema, model, Types, Document } from 'mongoose';

export type LedgerTransactionType =
  | 'referral_reward'
  | 'welcome_bonus'
  | 'manual_adjustment'
  | 'revocation';

export interface IReferralLedger extends Document {
  userId: Types.ObjectId;
  attributionId?: Types.ObjectId;
  campaignId?: Types.ObjectId;
  type: LedgerTransactionType;
  points: number;
  balanceAfter: number;
  description: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const ReferralLedgerSchema = new Schema<IReferralLedger>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    attributionId: { type: Schema.Types.ObjectId, ref: 'ReferralAttribution', index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'ReferralCampaign' },
    type: {
      type: String,
      enum: ['referral_reward', 'welcome_bonus', 'manual_adjustment', 'revocation'],
      required: true,
    },
    points: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Strictly immutable append-only ledger
  }
);

ReferralLedgerSchema.index({ userId: 1, createdAt: -1 });

export const ReferralLedger = model<IReferralLedger>('ReferralLedger', ReferralLedgerSchema);
