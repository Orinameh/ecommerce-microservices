import amqp, { type ChannelModel, type Channel, type ConsumeMessage } from 'amqplib';
import logger from './logger.ts';

export class RabbitMQ {
  private static instance: RabbitMQ | null = null;
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): RabbitMQ {
    if (!RabbitMQ.instance) {
      RabbitMQ.instance = new RabbitMQ();
    }
    return RabbitMQ.instance;
  }

  async connect(url: string): Promise<void> {
    if (this.isConnected && this.connection) {
      logger.info('RabbitMQ already connected');
      return;
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
      return;
    }

    this.connectionPromise = this.doConnect(url);
    await this.connectionPromise;
    this.connectionPromise = null;
  }

  private async doConnect(url: string): Promise<void> {
    try {
      // Connect to RabbitMQ — amqplib 0.10+/2.x returns a ChannelModel
      this.connection = await amqp.connect(url);

      // Create channel
      this.channel = await this.connection.createChannel();

      this.isConnected = true;

      // serverProperties lives on the nested raw Connection, not on ChannelModel itself
      const serverProps = this.connection.connection.serverProperties;
      logger.info('RabbitMQ connected successfully', {
        product: serverProps?.product || 'unknown',
        version: serverProps?.version || 'unknown',
        platform: serverProps?.platform || 'unknown'
      });

      // ChannelModel emits these events (forwarded from the underlying connection)
      this.connection.on('error', (error: Error) => {
        logger.error('RabbitMQ connection error:', error);
        this.isConnected = false;
        this.connection = null;
        this.channel = null;
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
        this.connection = null;
        this.channel = null;
      });

      this.connection.on('blocked', (reason: string) => {
        logger.warn('RabbitMQ connection blocked:', reason);
      });

      this.connection.on('unblocked', () => {
        logger.info('RabbitMQ connection unblocked');
      });

    } catch (error) {
      logger.error('RabbitMQ connection failed:', error);
      this.isConnected = false;
      this.connection = null;
      this.channel = null;
      throw error;
    }
  }

  async createQueue(queueName: string, options: any = { durable: true }): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized. Call connect() first.');
    }

    try {
      await this.channel.assertQueue(queueName, options);
      logger.info(`Queue created: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to create queue ${queueName}:`, error);
      throw error;
    }
  }

  async publish(queueName: string, data: any): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized. Call connect() first.');
    }

    try {
      const message = Buffer.from(JSON.stringify(data));
      this.channel.sendToQueue(queueName, message, {
        persistent: true,
        contentType: 'application/json'
      });
      logger.info(`Published to queue: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to publish to queue ${queueName}:`, error);
      throw error;
    }
  }

  async consume(queueName: string, callback: (data: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized. Call connect() first.');
    }

    try {
      // Set prefetch to 1 for fair distribution
      await this.channel.prefetch(1);

      await this.channel.consume(queueName, async (msg: ConsumeMessage | null) => {
        if (msg) {
          try {
            const content = msg.content.toString();
            const data = JSON.parse(content);
            await callback(data);
            this.channel!.ack(msg);
          } catch (error) {
            logger.error('Error processing message:', error);
            // Reject and requeue for retry
            this.channel!.nack(msg, false, true);
          }
        }
      }, { noAck: false });

      logger.info(`Listening on queue: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to consume from queue ${queueName}:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.isConnected = false;
      logger.info('RabbitMQ closed successfully');
    } catch (error) {
      logger.error('Error closing RabbitMQ:', error);
      throw error;
    }
  }

  isConnectedToRabbitMQ(): boolean {
    return this.isConnected && this.connection !== null && this.channel !== null;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected || !this.connection || !this.channel) {
        return false;
      }

      // Cheap round-trip against the default exchange — throws if the channel/connection is dead
      await this.channel.checkExchange('');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Reset connection (for testing)
  async reset(): Promise<void> {
    await this.close();
    this.connectionPromise = null;
  }
}