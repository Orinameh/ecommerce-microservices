import mongoose, { Schema, Document } from 'mongoose';

export interface IStockReservation extends Document {
  idempotencyKey: string; // order idempotency key or orderId
  productId: string;
  quantity: number;
  status: 'reserved' | 'released';
  createdAt: Date;
  updatedAt: Date;
}

const reservationSchema = new Schema<IStockReservation>({
  idempotencyKey: { type: String, required: true, unique: true },
  productId: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['reserved', 'released'], default: 'reserved' },
}, {
  timestamps: true,
  bufferCommands: false,
});

export const StockReservation = mongoose.model<IStockReservation>('StockReservation', reservationSchema);
