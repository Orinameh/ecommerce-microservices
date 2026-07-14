import { Transaction, ITransaction } from '../models/transaction.model';

export class TransactionRepository {
  async findById(id: string): Promise<ITransaction | null> {
    return await Transaction.findById(id);
  }

  async findByIdempotencyKey(key: string): Promise<ITransaction | null> {
    return await Transaction.findOne({ idempotencyKey: key });
  }

  async findAll(): Promise<ITransaction[]> {
    return await Transaction.find({}).sort({ createdAt: -1 });
  }

  async create(data: Partial<ITransaction>): Promise<ITransaction> {
    const transaction = new Transaction(data);
    return await transaction.save();
  }

  async updateStatus(id: string, status: string): Promise<ITransaction | null> {
    return await Transaction.findByIdAndUpdate(id, { status }, { new: true });
  }

  async updateProductId(id: string, productId: string): Promise<ITransaction | null> {
    return await Transaction.findByIdAndUpdate(id, { productId }, { new: true });
  }
}