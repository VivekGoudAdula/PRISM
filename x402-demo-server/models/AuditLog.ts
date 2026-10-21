import { Schema, model, Types } from 'mongoose';

export interface IAuditLog {
  userId?: Types.ObjectId;
  action:
    | 'Signup'
    | 'Login'
    | 'Logout'
    | 'Wallet Connected'
    | 'Task Started'
    | 'Task Planned'
    | 'Task Execution Started'
    | 'Task Completed'
    | 'Task Failed'
    | 'Endpoint Selected'
    | 'Payment Completed'
    | 'Verification Failed'
    | 'Legal Consent Renewed'
    | 'Account Deletion Requested'
    | 'Consent Withdrawn'
    | 'Data Export Requested'
    | 'Verified Account Erasure Executed';
  details?: any;
  ipAddress?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  action: {
    type: String,
    enum: [
      'Signup',
      'Login',
      'Logout',
      'Wallet Connected',
      'Task Started',
      'Task Planned',
      'Task Execution Started',
      'Task Completed',
      'Task Failed',
      'Endpoint Selected',
      'Payment Completed',
      'Verification Failed',
      'Legal Consent Renewed',
      'Account Deletion Requested',
      'Consent Withdrawn',
      'Data Export Requested',
      'Verified Account Erasure Executed',
    ],
    required: true,
    index: true,
  },
  details: { type: Schema.Types.Mixed },
  ipAddress: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);
