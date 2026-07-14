import mongoose, { Schema, Document } from 'mongoose';

export interface IOrder extends Document {
  idempotencyKey: string;
  customerId: string;
  productId: string;
  amount: number;
  orderStatus: 'pending' | 'paid' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>({
  idempotencyKey: {
    type: String,
    required: true,
    unique: true
  },
  customerId: {
    type: String,
    required: true
  },
  productId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'cancelled'],
    default: 'pending'
  }
}, {
  timestamps: true,
  bufferCommands: false,
});

export const Order = mongoose.model<IOrder>('Order', orderSchema);