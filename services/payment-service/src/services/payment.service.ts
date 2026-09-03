import { PaymentStatus, TransactionStatus } from '../../../../shared/utils/status';
import logger from '../../../../shared/utils/logger';
import { TransactionRepository } from '../repositories/transaction.repository';
import { OutboxRepository } from '../repositories/outbox.repository';
import { RabbitMQService } from './rabbitmq.service';
import { AppError, MONGO_DUPLICATE_KEY_ERROR } from '../../../../shared/utils/errors';

export class PaymentService {
  private repository: TransactionRepository;
  private outboxRepository: OutboxRepository;
  private rabbitmq: RabbitMQService;
  private outboxPoller: NodeJS.Timeout | null = null;

  constructor() {
    this.repository = new TransactionRepository();
    this.outboxRepository = new OutboxRepository();
    this.rabbitmq = new RabbitMQService();
  }

  async processPayment(data: {
    customerId: string;
    orderId: string;
    amount: number;
    productId?: string;
    idempotencyKey: string;
  }): Promise<{ status: PaymentStatus; transactionId: string }> {
    if (!data.idempotencyKey || typeof data.idempotencyKey !== 'string') {
      throw new AppError('Idempotency key is required', 400);
    }
    const key = data.idempotencyKey;

    const existing = await this.repository.findByIdempotencyKey(key);
    if (existing) {
      if (existing.status === TransactionStatus.FAILED) {
        return {
          status: PaymentStatus.FAILED,
          transactionId: existing._id.toString()
        };
      }
      logger.info(`Idempotent payment request: ${key}`);
      return {
        status: PaymentStatus.SUCCESS,
        transactionId: existing._id.toString()
      };
    }

    let transaction;
    try {
      transaction = await this.repository.create({
        idempotencyKey: key,
        customerId: data.customerId,
        orderId: data.orderId,
        amount: data.amount,
        status: TransactionStatus.PENDING
      });
    } catch (error: any) {
      if (error.code === MONGO_DUPLICATE_KEY_ERROR) {
        const existingRetry = await this.repository.findByIdempotencyKey(key);
        if (existingRetry) {
          logger.info(`Idempotent payment race recovered: ${key}`);
          return {
            status: existingRetry.status === TransactionStatus.FAILED ? PaymentStatus.FAILED : PaymentStatus.SUCCESS,
            transactionId: existingRetry._id.toString()
          };
        }
      }
      throw error;
    }

    logger.info(`Transaction created: ${transaction._id}`);

    const paymentSuccess = true;

    if (paymentSuccess) {
      await this.repository.updateStatus(transaction._id.toString(), TransactionStatus.COMPLETED);

      if (data.productId) {
        await this.repository.updateProductId(transaction._id.toString(), data.productId);
      }

      const payload = {
        transactionId: transaction._id.toString(),
        customerId: data.customerId,
        orderId: data.orderId,
        productId: data.productId,
        amount: data.amount,
        idempotencyKey: key
      };

      // Outbox pattern: persist event before publish — aligns with README step 6
      // Transaction is COMPLETED, outbox is pending, publish is async. If publish fails, poller retries.
      try {
        const existingOutbox = await this.outboxRepository.findByIdempotencyKey(key);
        if (!existingOutbox) {
          await this.outboxRepository.create({
            idempotencyKey: key,
            transactionId: transaction._id.toString(),
            payload,
            status: 'pending',
            attempts: 0,
          });
        }
      } catch (e: any) {
        // duplicate outbox or DB error — log but continue to publish
        if (e.code !== MONGO_DUPLICATE_KEY_ERROR) {
          logger.warn(`Outbox create failed for ${key}: ${e.message}`);
        }
      }

      try {
        await this.publishWithRetry(payload);
        // Mark outbox published
        try {
          const outbox = await this.outboxRepository.findByIdempotencyKey(key);
          if (outbox) await this.outboxRepository.markPublished(outbox._id.toString());
        } catch {}
      } catch (e: any) {
        // Publish failed after retries — keep outbox pending for poller, but return SUCCESS
        // Worker replay will eventually consume via poller; aligns with README step 6-7
        logger.error(`Publish failed, outbox pending for retry: ${key}`, { transactionId: transaction._id.toString(), error: e.message });
        try {
          const outbox = await this.outboxRepository.findByIdempotencyKey(key);
          if (outbox) await this.outboxRepository.incrementAttempts(outbox._id.toString(), e.message);
        } catch {}
      }

      logger.info(`Payment completed for order: ${data.orderId}`);

      return {
        status: PaymentStatus.SUCCESS,
        transactionId: transaction._id.toString()
      };
    } else {
      await this.repository.updateStatus(transaction._id.toString(), TransactionStatus.FAILED);
      throw new AppError('Payment declined', 400);
    }
  }

  async getTransactionById(id: string): Promise<any> {
    const transaction = await this.repository.findById(id);
    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }
    return transaction;
  }

  async getAllTransactions(): Promise<any[]> {
    return await this.repository.findAll();
  }

  private async publishWithRetry(data: any, maxAttempts = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.rabbitmq.publishTransaction(data);
        return;
      } catch (error: any) {
        logger.warn(`Publish attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
        if (attempt === maxAttempts) {
          logger.error('Publish failed after retries, transaction remains COMPLETED but not enqueued - worker replay required', { transactionId: data.transactionId });
          throw error;
        }
        await new Promise(r => setTimeout(r, attempt * 500));
      }
    }
  }

  async initRabbitMQ(): Promise<void> {
    await this.rabbitmq.connect();
    this.startOutboxPoller();
  }

  async closeRabbitMQ(): Promise<void> {
    this.stopOutboxPoller();
    await this.rabbitmq.close();
  }

  private startOutboxPoller(): void {
    if (this.outboxPoller) return;
    // Poll every 10s for pending outbox events — aligns with README async worker flow
    this.outboxPoller = setInterval(async () => {
      try {
        const pending = await this.outboxRepository.findPending(20);
        for (const item of pending) {
          try {
            await this.rabbitmq.publishTransaction(item.payload);
            await this.outboxRepository.markPublished(item._id.toString());
            logger.info(`Outbox poller published: ${item.idempotencyKey}`);
          } catch (e: any) {
            await this.outboxRepository.incrementAttempts(item._id.toString(), e.message);
            logger.warn(`Outbox poller failed for ${item.idempotencyKey}: ${e.message}`);
          }
        }
      } catch (e: any) {
        logger.warn(`Outbox poller error: ${e.message}`);
      }
    }, 10000);
    // Don't block process exit
    if (this.outboxPoller && typeof (this.outboxPoller as any).unref === 'function') {
      (this.outboxPoller as any).unref();
    }
  }

  private stopOutboxPoller(): void {
    if (this.outboxPoller) {
      clearInterval(this.outboxPoller);
      this.outboxPoller = null;
    }
  }
}
