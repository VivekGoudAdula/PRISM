import { Schema, model, Document } from 'mongoose';

export interface IReferralCampaign extends Document {
  name: string;
  code: string;
  description: string;
  referrerPoints: number;
  refereePoints: number;
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
  rulesVersion: string;
  limits: {
    maxReferralsPerUser: number;
    totalCampaignBudgetPoints: number;
  };
  qualificationCriteria: {
    minTaskCostUSD: number;
    allowedNetworks: string[];
    requirePaymentCompleted: boolean;
    disallowMockSignaturesInProd: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ReferralCampaignSchema = new Schema<IReferralCampaign>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    referrerPoints: { type: Number, required: true, default: 5, min: 0 },
    refereePoints: { type: Number, required: true, default: 10, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    rulesVersion: { type: String, default: '1.0' },
    limits: {
      maxReferralsPerUser: { type: Number, default: 0, min: 0 }, // 0 = unlimited
      totalCampaignBudgetPoints: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    },
    qualificationCriteria: {
      minTaskCostUSD: { type: Number, default: 0.01, min: 0 },
      allowedNetworks: { type: [String], default: ['MAINNET', 'TESTNET'] },
      requirePaymentCompleted: { type: Boolean, default: true },
      disallowMockSignaturesInProd: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

ReferralCampaignSchema.index({ isActive: 1, startDate: -1 });

export const ReferralCampaign = model<IReferralCampaign>('ReferralCampaign', ReferralCampaignSchema);
