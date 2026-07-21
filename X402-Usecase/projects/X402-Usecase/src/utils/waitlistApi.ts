import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4021';

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

export interface WaitlistFormData {
  name: string;
  email: string;
  company: string;
  role: WaitlistRole;
  interestedFeatures: WaitlistFeature[];
  source?: string;
}

export interface WaitlistSuccessResponse {
  success: true;
  message: string;
  position: number;
  entry: {
    email: string;
    name?: string;
    createdAt: string;
  };
}

export interface WaitlistCountResponse {
  count: number;
}

const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export async function fetchWaitlistCount(): Promise<number> {
  const { data } = await publicApi.get<WaitlistCountResponse>('/api/waitlist/count');
  return data.count;
}

export async function joinWaitlist(form: WaitlistFormData): Promise<WaitlistSuccessResponse> {
  const { data } = await publicApi.post<WaitlistSuccessResponse>('/api/waitlist', {
    ...form,
    source: form.source || 'landing_page',
  });
  return data;
}

export const WAITLIST_ROLES: WaitlistRole[] = [
  'Founder',
  'HR',
  'Recruiter',
  'Developer',
  'Student',
  'Product Manager',
  'Other',
];

export const WAITLIST_FEATURES: WaitlistFeature[] = [
  'Resume Screening',
  'Invoice Extraction',
  'Contract Analysis',
  'Research',
  'Customer Support',
  'Code Review',
  'Data Extraction',
  'Other',
];

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
