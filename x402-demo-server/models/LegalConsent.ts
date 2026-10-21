import { Schema, model, Types } from 'mongoose';

export interface ILegalConsent {
  userId: Types.ObjectId;
  userEmail?: string;
  termsVersion: string;
  privacyVersion: string;
  revisionId: string;
  agreedToTerms: boolean;
  acknowledgedPrivacyPolicy: boolean;
  acceptedAt: Date;
  signupFlow: 'email_signup' | 'wallet_connect' | 'renewed_acceptance' | 'admin_action';
  ipAddress?: string;
  userAgent?: string;
  status: 'active' | 'superseded' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
}

const LegalConsentSchema = new Schema<ILegalConsent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userEmail: { type: String, default: '' },
    termsVersion: { type: String, required: true },
    privacyVersion: { type: String, required: true },
    revisionId: { type: String, required: true },
    agreedToTerms: { type: Boolean, required: true },
    acknowledgedPrivacyPolicy: { type: Boolean, required: true },
    acceptedAt: { type: Date, required: true, default: Date.now },
    signupFlow: {
      type: String,
      enum: ['email_signup', 'wallet_connect', 'renewed_acceptance', 'admin_action'],
      default: 'email_signup',
    },
    ipAddress: { type: String, default: '127.0.0.1' },
    userAgent: { type: String, default: 'Unknown' },
    status: {
      type: String,
      enum: ['active', 'superseded', 'revoked'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find user active consent
LegalConsentSchema.index({ userId: 1, status: 1 });

export const LegalConsent = model<ILegalConsent>('LegalConsent', LegalConsentSchema);
