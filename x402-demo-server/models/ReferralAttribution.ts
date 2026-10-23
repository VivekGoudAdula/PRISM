import { Schema, model, Types, Document } from 'mongoose';

export type AttributionStatus = 'pending' | 'qualified' | 'rejected';

export interface IQualificationMetadata {
  taskCostUSD?: number;
  paymentAmount?: number;
  network?: string;
  currency?: string;
  transactionId?: string;
  verifiedAt?: Date;
}

export interface IReferralAttribution extends Document {
  referrerId: Types.ObjectId;
  refereeId: Types.ObjectId;
  referralCodeUsed: string;
  campaignId: Types.ObjectId;
  status: AttributionStatus;
  qualifyingTaskId?: Types.ObjectId;
  qualifyingPaymentId?: Types.ObjectId;
  qualifiedAt?: Date;
  qualificationMetadata?: IQualificationMetadata;
  clientIp?: string;
  userAgent?: string;
  adminReview?: {
    reviewedBy?: Types.ObjectId;
    reviewedAt?: Date;
    reason?: string;
    previousStatus?: AttributionStatus;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ReferralAttributionSchema = new Schema<IReferralAttribution>(
  {
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
      unique: true, // Strictly exactly one referrer attribution per referee account
    },
    referralCodeUsed: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'ReferralCampaign',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'qualified', 'rejected'],
      default: 'pending',
      index: true,
    },
    qualifyingTaskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      index: true,
    },
    qualifyingPaymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payments',
      index: true,
    },
    qualifiedAt: {
      type: Date,
    },
    qualificationMetadata: {
      taskCostUSD: { type: Number },
      paymentAmount: { type: Number },
      network: { type: String },
      currency: { type: String },
      transactionId: { type: String },
      verifiedAt: { type: Date },
    },
    clientIp: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    adminReview: {
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
      reason: { type: String },
      previousStatus: { type: String, enum: ['pending', 'qualified', 'rejected'] },
    },
  },
  {
    timestamps: true,
  }
);

ReferralAttributionSchema.index({ referrerId: 1, status: 1 });
ReferralAttributionSchema.index({ status: 1, createdAt: -1 });

export const ReferralAttribution = model<IReferralAttribution>('ReferralAttribution', ReferralAttributionSchema);
