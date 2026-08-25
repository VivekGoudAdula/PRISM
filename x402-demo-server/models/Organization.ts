import { Schema, model } from 'mongoose';

export interface IOrganization {
  name: string;
  code?: string;
  contactPerson?: string;
  contactEmail?: string;
  industry?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>({
  name: { type: String, required: true, unique: true, index: true },
  code: { type: String, index: true },
  contactPerson: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  industry: { type: String, default: 'Technology' },
  notes: { type: String, default: '' },
}, {
  timestamps: true,
});

export const Organization = model<IOrganization>('Organization', OrganizationSchema);
