import mongoose, { Schema, Document } from 'mongoose';
import { OrderStatus } from '../../../../shared/utils/status';

export interface IOrder extends Document {
  idempotencyKey: string;
  customerId: string;
  productId: string;
  amount: number;
  orderStatus: OrderStatus;
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
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING
  }
}, {
  timestamps: true,
  bufferCommands: false,
});

export const Order = mongoose.model<IOrder>('Order', orderSchema);