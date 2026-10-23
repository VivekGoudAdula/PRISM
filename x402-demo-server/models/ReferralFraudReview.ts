import { Schema, model, Types, Document } from 'mongoose';

export type ReviewAction = 'approve' | 'reject';

export interface IReferralFraudReview extends Document {
  attributionId: Types.ObjectId;
  referrerId: Types.ObjectId;
  refereeId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  action: ReviewAction;
  reason: string;
  pointsRevoked: number;
  compensatingLedgerId?: Types.ObjectId;
  clientIp?: string;
  userAgent?: string;
  createdAt: Date;
}

const ReferralFraudReviewSchema = new Schema<IReferralFraudReview>(
  {
    attributionId: {
      type: Schema.Types.ObjectId,
      ref: 'ReferralAttribution',
      required: true,
      index: true,
    },
    referrerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refereeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['approve', 'reject'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    pointsRevoked: {
      type: Number,
      default: 0,
      min: 0,
    },
    compensatingLedgerId: {
      type: Schema.Types.ObjectId,
      ref: 'ReferralLedger',
    },
    clientIp: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable record
  }
);

ReferralFraudReviewSchema.index({ attributionId: 1, createdAt: -1 });
ReferralFraudReviewSchema.index({ reviewerId: 1, createdAt: -1 });

export const ReferralFraudReview = model<IReferralFraudReview>('ReferralFraudReview', ReferralFraudReviewSchema);
