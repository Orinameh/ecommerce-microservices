import { v4 as uuidv4 } from 'uuid';
import { PaymentStatus, TransactionStatus } from '../../../../shared/utils/status';
import logger from '../../../../shared/utils/logger';
import { TransactionRepository } from '../repositories/transaction.repository';
import { RabbitMQService } from './rabbitmq.service';

export class PaymentService {
  private repository: TransactionRepository;
  private rabbitmq: RabbitMQService;

  constructor() {
    this.repository = new TransactionRepository();
    this.rabbitmq = new RabbitMQService();
  }

  async processPayment(data: {
    customerId: string;
    orderId: string;
    amount: number;
    productId?: string;
    idempotencyKey?: string;
  }): Promise<{ status: PaymentStatus; transactionId: string }> {
    const key = data.idempotencyKey || uuidv4();

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

    const transaction = await this.repository.create({
      idempotencyKey: key,
      customerId: data.customerId,
      orderId: data.orderId,
      amount: data.amount,
      status: TransactionStatus.PENDING
    });

    logger.info(`Transaction created: ${transaction._id}`);

    const paymentSuccess = true;

    if (paymentSuccess) {
      await this.repository.updateStatus(transaction._id.toString(), TransactionStatus.COMPLETED);

      if (data.productId) {
        await this.repository.updateProductId(transaction._id.toString(), data.productId);
      }

      await this.rabbitmq.publishTransaction({
        transactionId: transaction._id.toString(),
        customerId: data.customerId,
        orderId: data.orderId,
        productId: data.productId,
        amount: data.amount,
        idempotencyKey: key
      });

      logger.info(`Payment completed for order: ${data.orderId}`);

      return {
        status: PaymentStatus.SUCCESS,
        transactionId: transaction._id.toString()
      };
    } else {
      await this.repository.updateStatus(transaction._id.toString(), TransactionStatus.FAILED);
      throw new Error('Payment declined');
    }
  }

  async getTransactionById(id: string): Promise<any> {
    const transaction = await this.repository.findById(id);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    return transaction;
  }

  async getAllTransactions(): Promise<any[]> {
    return await this.repository.findAll();
  }

  async initRabbitMQ(): Promise<void> {
    await this.rabbitmq.connect();
  }

  async closeRabbitMQ(): Promise<void> {
    await this.rabbitmq.close();
  }
}
