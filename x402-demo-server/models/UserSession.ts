import { Schema, model, Types } from 'mongoose';

export interface IUserSession {
  userId: Types.ObjectId;
  refreshToken: string;
  ipAddress?: string;
  browser?: string;
  operatingSystem?: string;
  country?: string;
  device?: string;
  lastActivity: Date;
  expiresAt: Date;
}

const UserSessionSchema = new Schema<IUserSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  refreshToken: { type: String, required: true, unique: true, index: true },
  ipAddress: { type: String, default: '' },
  browser: { type: String, default: '' },
  operatingSystem: { type: String, default: '' },
  country: { type: String, default: '' },
  device: { type: String, default: '' },
  lastActivity: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

export const UserSession = model<IUserSession>('UserSession', UserSessionSchema);
