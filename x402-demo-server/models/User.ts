import { Schema, model } from 'mongoose';

export interface IUser {
  fullName: string;
  email: string;
  passwordHash: string;
  walletAddress?: string;
  avatar?: string;
  role: 'user' | 'admin';
  subscriptionPlan: 'free' | 'pro' | 'enterprise';
  credits: number;
  lastLogin?: Date;
  totalTasks: number;
  totalSpent: number;
  totalSaved: number;
  totalEndpointsUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true, lowercase: true },
  passwordHash: { type: String, required: true },
  walletAddress: { type: String, default: '' },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  subscriptionPlan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  credits: { type: Number, default: 100 },
  lastLogin: { type: Date },
  totalTasks: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  totalSaved: { type: Number, default: 0 },
  totalEndpointsUsed: { type: Number, default: 0 },
}, {
  timestamps: true
});

export const User = model<IUser>('User', UserSchema);
