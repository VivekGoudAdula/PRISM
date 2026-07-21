import { Schema, model } from 'mongoose';

export type WaitlistRole =
  | 'Founder'
  | 'HR'
  | 'Recruiter'
  | 'Developer'
  | 'Student'
  | 'Product Manager'
  | 'Other';

export type WaitlistFeature =
  | 'Resume Screening'
  | 'Invoice Extraction'
  | 'Contract Analysis'
  | 'Research'
  | 'Customer Support'
  | 'Code Review'
  | 'Data Extraction'
  | 'Other';

export interface IWaitlist {
  name: string;
  email: string;
  company: string;
  role: WaitlistRole;
  challenge?: string;
  interestedFeatures: WaitlistFeature[];
  source: string;
  status: 'waiting' | 'invited' | 'converted';
  createdAt: Date;
  updatedAt: Date;
}

const WaitlistSchema = new Schema<IWaitlist>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    role: {
      type: String,
      required: true,
      enum: ['Founder', 'HR', 'Recruiter', 'Developer', 'Student', 'Product Manager', 'Other'],
    },
    challenge: { type: String, default: '' },
    interestedFeatures: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'At least one AI task must be selected.',
      },
      enum: [
        'Resume Screening',
        'Invoice Extraction',
        'Contract Analysis',
        'Research',
        'Customer Support',
        'Code Review',
        'Data Extraction',
        'Other',
      ],
    },
    source: { type: String, default: 'landing_page' },
    status: { type: String, enum: ['waiting', 'invited', 'converted'], default: 'waiting' },
  },
  { timestamps: true }
);

export const Waitlist = model<IWaitlist>('Waitlist', WaitlistSchema);
