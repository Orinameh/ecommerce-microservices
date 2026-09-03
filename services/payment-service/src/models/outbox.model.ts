import mongoose, { Schema, Document } from 'mongoose';

export interface IOutbox extends Document {
  idempotencyKey: string;
  transactionId: string;
  payload: Record<string, any>;
  status: 'pending' | 'published' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const outboxSchema = new Schema<IOutbox>({
  idempotencyKey: { type: String, required: true, unique: true },
  transactionId: { type: String, required: true },
  payload: { type: Object, required: true },
  status: { type: String, enum: ['pending', 'published', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  lastError: { type: String },
}, {
  timestamps: true,
  bufferCommands: false,
});

if ((outboxSchema as any).index) {
  outboxSchema.index({ status: 1, createdAt: 1 });
}

export const Outbox = mongoose.model<IOutbox>('Outbox', outboxSchema);
