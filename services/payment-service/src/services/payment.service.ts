import { v4 as uuidv4 } from 'uuid';
import { HttpClientFactory } from '../../../../shared/utils/httpClient';
import { config } from '../config';
import logger from '../../../../shared/utils/logger';
import { TransactionRepository } from '../repositories/transaction.repository';
import { RabbitMQService } from './rabbitmq.service';

export class PaymentService {
  private repository: TransactionRepository;
  private rabbitmq: RabbitMQService;
  private orderClient = HttpClientFactory.getClient({
    baseURL: config.orderServiceUrl,
    serviceName: 'order-service',
    timeout: 3000,
    maxRetries: 2,
    retryDelay: 500
  });

  constructor() {
    this.repository = new TransactionRepository();
    this.rabbitmq = new RabbitMQService();
  }

  async processPayment(data: {
    customerId: string;
    orderId: string;
    amount: number;
    idempotencyKey?: string;
  }): Promise<{ status: string; transactionId: string }> {
    const key = data.idempotencyKey || uuidv4();

    const existing = await this.repository.findByIdempotencyKey(key);
    if (existing) {
      logger.info(`Idempotent payment request: ${key}`);
      return {
        status: existing.status,
        transactionId: existing._id.toString()
      };
    }

    const transaction = await this.repository.create({
      idempotencyKey: key,
      customerId: data.customerId,
      orderId: data.orderId,
      amount: data.amount,
      status: 'pending'
    });

    logger.info(`Transaction created: ${transaction._id}`);

    const paymentSuccess = true;

    if (paymentSuccess) {
      await this.repository.updateStatus(transaction._id.toString(), 'completed');

      let productId: string | undefined;

      try {
        const order = await this.orderClient.get<any>(`/api/orders/${data.orderId}`);
        if (order && order.productId) {
          await this.repository.updateProductId(transaction._id.toString(), order.productId);
          productId = order.productId;
        }
      } catch (error) {
        logger.warn('Could not fetch productId from order service');
      }

      await this.rabbitmq.publishTransaction({
        transactionId: transaction._id.toString(),
        customerId: data.customerId,
        orderId: data.orderId,
        productId,
        amount: data.amount,
        idempotencyKey: key
      });

      logger.info(`Payment completed for order: ${data.orderId}`);

      return {
        status: 'success',
        transactionId: transaction._id.toString()
      };
    } else {
      await this.repository.updateStatus(transaction._id.toString(), 'failed');
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
