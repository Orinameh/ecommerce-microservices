import mongoose, { Schema, Document } from 'mongoose';
import { TransactionStatus } from '../../../../shared/utils/status';

export interface ITransaction extends Document {
  idempotencyKey: string;
  customerId: string;
  orderId: string;
  productId?: string;
  amount: number;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
  idempotencyKey: {
    type: String,
    required: true,
    unique: true
  },
  customerId: {
    type: String,
    required: true
  },
  orderId: {
    type: String,
    required: true
  },
  productId: {
    type: String
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: Object.values(TransactionStatus),
    default: TransactionStatus.PENDING
  }
}, {
  timestamps: true,
  bufferCommands: false,
});

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);