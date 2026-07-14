import { RabbitMQ } from '../../../../shared/utils/rabbitmq';
import { config } from '../config';
import logger from '../../../../shared/utils/logger';

const QUEUE_NAME = 'transaction_queue';

export class RabbitMQService {
  private rabbitmq: RabbitMQ;

  constructor() {
    this.rabbitmq = RabbitMQ.getInstance();
  }

  async connect(): Promise<void> {
    await this.rabbitmq.connect(config.rabbitmqUrl);
    await this.rabbitmq.createQueue(QUEUE_NAME, { durable: true });
    logger.info(`Queue created: ${QUEUE_NAME}`);
  }

  async publishTransaction(data: any): Promise<void> {
    await this.rabbitmq.publish(QUEUE_NAME, data);
  }

  async consume(callback: (data: any) => Promise<void>): Promise<void> {
    await this.rabbitmq.consume(QUEUE_NAME, callback);
  }

  async close(): Promise<void> {
    await this.rabbitmq.close();
  }
}