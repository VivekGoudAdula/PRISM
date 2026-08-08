import { Schema, model, Types } from 'mongoose';

export interface IDataMapNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  category?: string;
  parentId?: string;
  importance?: number;
  tokenEstimate?: number;
  relevanceScore?: number;
  includedInContext?: boolean;
  metadata?: any;
}

export interface IDataMapEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  weight?: number;
  metadata?: any;
}

export interface IDataMap {
  userId: Types.ObjectId;
  taskId?: Types.ObjectId;
  chatId?: string;
  title?: string;
  executionId?: string;
  taskType: string;
  rootNodeId: string;
  nodes: IDataMapNode[];
  edges: IDataMapEdge[];
  metadata?: {
    nodeCount: number;
    edgeCount: number;
    relevancePercent: number;
    estimatedContextTokens: number;
    potentiallyIrrelevantTokens: number;
    taskIntent?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DataMapNodeSchema = new Schema<IDataMapNode>(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String },
    parentId: { type: String },
    importance: { type: Number, default: 5 },
    tokenEstimate: { type: Number, default: 0 },
    relevanceScore: { type: Number, default: 0.8 },
    includedInContext: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const DataMapEdgeSchema = new Schema<IDataMapEdge>(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    relationship: { type: String, required: true },
    weight: { type: Number, default: 1 },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const DataMapSchema = new Schema<IDataMap>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', index: true },
    chatId: { type: String, index: true },
    title: { type: String },
    executionId: { type: String },
    taskType: { type: String, required: true },
    rootNodeId: { type: String, required: true },
    nodes: [DataMapNodeSchema],
    edges: [DataMapEdgeSchema],
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

DataMapSchema.index({ userId: 1, createdAt: -1 });
DataMapSchema.index({ chatId: 1 });
DataMapSchema.index({ executionId: 1 });

export const DataMap = model<IDataMap>('DataMap', DataMapSchema);
