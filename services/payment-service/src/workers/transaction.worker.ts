import { Database } from '../../../../shared/utils/database';
import { HttpClientFactory } from '../../../../shared/utils/httpClient';
import { OrderStatus } from '../../../../shared/utils/status';
import { TransactionStatus } from '../../../../shared/utils/status';
import { config } from '../config/index';
import logger from '../../../../shared/utils/logger';
import { TransactionRepository } from '../repositories/transaction.repository';
import { RabbitMQService } from '../services/rabbitmq.service';

const QUEUE_NAME = 'transaction_queue';

class TransactionWorker {
  private rabbitmq: RabbitMQService;
  private repository: TransactionRepository;
  private orderClient = HttpClientFactory.getClient({
    baseURL: config.orderServiceUrl,
    serviceName: 'order-service',
    timeout: 3000,
    maxRetries: 2,
    retryDelay: 500
  });
  private shuttingDown = false;

  constructor() {
    this.rabbitmq = new RabbitMQService();
    this.repository = new TransactionRepository();
  }

  async start(): Promise<void> {
    try {
      await Database.getInstance().connect(config.mongodbUri);
      logger.info('Worker: Database connected');

      await this.rabbitmq.connect();

      await this.rabbitmq.consume(async (data: any) => {
        if (this.shuttingDown) {
          return;
        }

        logger.info(`Worker: Transaction received: ${data.transactionId}`);

        const transaction = await this.repository.updateStatus(
          data.transactionId,
          TransactionStatus.COMPLETED
        );

        if (transaction) {
          if (data.productId && !transaction.productId) {
            await this.repository.updateProductId(data.transactionId, data.productId);
          }

          logger.info(`Worker: Transaction saved: ${data.transactionId}`);

          try {
            await this.orderClient.put('/api/orders/status', {
              orderId: data.orderId,
              status: OrderStatus.PAID
            });
            logger.info(`Worker: Order ${data.orderId} updated to paid`);
          } catch (error: any) {
            logger.warn(`Worker: Could not update order status: ${error.message}`);
          }
        } else {
          logger.error(`Worker: Transaction not found: ${data.transactionId}`);
        }
      });

      logger.info(`Worker: Started and listening on ${QUEUE_NAME}`);
    } catch (error) {
      logger.error('Worker: Startup failed:', error);
      setTimeout(() => this.start(), 5000);
    }
  }

  async stop(): Promise<void> {
    this.shuttingDown = true;
    logger.info('Worker: Draining, no new messages accepted');
    await this.rabbitmq.close();
    await Database.getInstance().disconnect();
    logger.info('Worker: Stopped');
  }
}

const worker = new TransactionWorker();
worker.start().catch((error) => {
  logger.error('Worker: Failed to start:', error);
  process.exit(1);
});

const shutdown = async () => {
  logger.info('Worker: Shutting down...');
  await worker.stop();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
