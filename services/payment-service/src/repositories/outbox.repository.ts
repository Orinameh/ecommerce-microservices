import { Outbox, IOutbox } from '../models/outbox.model';

export class OutboxRepository {
  async create(data: Partial<IOutbox>): Promise<IOutbox> {
    const doc = new Outbox(data);
    return await doc.save();
  }

  async findPending(limit = 20): Promise<IOutbox[]> {
    return await Outbox.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(limit);
  }

  async findByIdempotencyKey(key: string): Promise<IOutbox | null> {
    return await Outbox.findOne({ idempotencyKey: key });
  }

  async markPublished(id: string): Promise<void> {
    await Outbox.findByIdAndUpdate(id, { status: 'published', lastError: undefined });
  }

  async markFailed(id: string, error: string, attempts: number): Promise<void> {
    await Outbox.findByIdAndUpdate(id, { status: attempts >= 10 ? 'failed' : 'pending', lastError: error, attempts });
  }

  async incrementAttempts(id: string, error: string): Promise<void> {
    const doc = await Outbox.findById(id);
    if (!doc) return;
    const next = doc.attempts + 1;
    await Outbox.findByIdAndUpdate(id, { attempts: next, lastError: error, status: next >= 10 ? 'failed' : 'pending' });
  }
}
