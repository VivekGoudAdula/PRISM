import { Schema, model, Types, Document } from 'mongoose';

export type ProfileStatus = 'active' | 'suspended';

export interface IReferralProfile extends Document {
  userId: Types.ObjectId;
  referralCode: string;
  status: ProfileStatus;
  totalReferred: number;
  totalQualified: number;
  totalPointsEarned: number;
  customSlug?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralProfileSchema = new Schema<IReferralProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    totalReferred: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalQualified: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    customSlug: {
      type: String,
      sparse: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

ReferralProfileSchema.index({ referralCode: 1, status: 1 });

export const ReferralProfile = model<IReferralProfile>('ReferralProfile', ReferralProfileSchema);
