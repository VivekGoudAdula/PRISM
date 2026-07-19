import { Schema, model, Types } from 'mongoose';

export interface IEndpointUsage {
  endpointName: string;
  endpointId: string;
  provider: string;
  responseTime: number; // latency in ms
  cost: number;
  qualityScore: number;
  userId: Types.ObjectId;
  taskId: Types.ObjectId;
  timestamp: Date;
}

const EndpointUsageSchema = new Schema<IEndpointUsage>({
  endpointName: { type: String, required: true },
  endpointId: { type: String, required: true },
  provider: { type: String, required: true },
  responseTime: { type: Number, required: true },
  cost: { type: Number, default: 0 },
  qualityScore: { type: Number, default: 0 },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  timestamp: { type: Date, default: Date.now },
});

export const EndpointUsage = model<IEndpointUsage>('EndpointUsage', EndpointUsageSchema);
