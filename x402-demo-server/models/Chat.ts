import { Schema, model, Types } from 'mongoose';

export interface IConversation {
  userId: Types.ObjectId;
  title: string;
  activeTaskId?: Types.ObjectId;
  /** Serialized chatHistory array — full thread including task results, replies, and errors */
  thread: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage {
  conversationId: Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ConversationSchema = new Schema<IConversation>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  activeTaskId: { type: Schema.Types.ObjectId, ref: 'Task' },
  thread: { type: Schema.Types.Mixed, default: [] },
}, {
  timestamps: true
});

const MessageSchema = new Schema<IMessage>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const Conversation = model<IConversation>('Conversation', ConversationSchema);
export const Message = model<IMessage>('Message', MessageSchema);
