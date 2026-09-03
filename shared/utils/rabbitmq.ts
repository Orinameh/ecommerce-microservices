import amqp, { type ChannelModel, type Channel, type ConsumeMessage } from 'amqplib';
import logger from './logger';

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
      this.connection = await amqp.connect(url);

      this.channel = await this.connection.createConfirmChannel();

      this.isConnected = true;

      const serverProps = this.connection.connection.serverProperties;
      logger.info('RabbitMQ connected successfully', {
        product: serverProps?.product || 'unknown',
        version: serverProps?.version || 'unknown',
        platform: serverProps?.platform || 'unknown'
      });

      this.connection.on('error', (error: Error) => {
        logger.error('RabbitMQ connection error:', error);
        this.isConnected = false;
        this.connection = null;
        this.channel = null;
        this.connectionPromise = null;
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
        this.connection = null;
        this.channel = null;
        this.connectionPromise = null;
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
      // Declare DLX/DLQ if not the DLQ itself - handle pre-existing queue without DLX args
      if (!queueName.endsWith('_dlq')) {
        const dlqName = `${queueName}_dlq`;
        try {
          await this.channel.assertQueue(dlqName, { durable: true });
        } catch (e) {
          logger.warn(`DLQ declare failed for ${dlqName}:`, e);
        }
        const optsWithDLX = {
          ...options,
          arguments: {
            ...(options.arguments || {}),
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': dlqName,
          },
        };
        try {
          await this.channel.assertQueue(queueName, optsWithDLX);
        } catch (e: any) {
          const msg = e?.message || String(e);
          if (msg.includes('precondition_failed') && msg.includes('x-dead-letter')) {
            logger.warn(`Queue ${queueName} exists without DLX args (pre-existing volume) — falling back to plain declare`, { error: msg });
            // Workaround: passive check or plain declare without DLX will succeed if queue exists
            try {
              await this.channel.checkQueue(queueName);
              logger.info(`Queue ${queueName} already exists, using existing definition`);
            } catch {
              await this.channel.assertQueue(queueName, options);
            }
          } else {
            throw e;
          }
        }
      } else {
        await this.channel.assertQueue(queueName, options);
      }
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
      const sent = this.channel.sendToQueue(queueName, message, {
        persistent: true,
        contentType: 'application/json'
      });
      if (!sent) {
        throw new Error('sendToQueue returned false (write buffer full)');
      }
      // Wait for broker confirm if confirm channel
      const confirmChannel: any = this.channel;
      if (confirmChannel.waitForConfirms) {
        await confirmChannel.waitForConfirms();
      }
      logger.info(`Published to queue: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to publish to queue ${queueName}:`, error);
      throw error;
    }
  }

  async consume(queueName: string, callback: (data: any) => Promise<void>, maxRetries: number = 3): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized. Call connect() first.');
    }

    try {
      await this.channel.prefetch(1);

      await this.channel.consume(queueName, async (msg: ConsumeMessage | null) => {
        if (msg) {
          try {
            const content = msg.content.toString();
            const data = JSON.parse(content);
            await callback(data);
            this.channel!.ack(msg);
          } catch (error) {
            if (error instanceof SyntaxError) {
              logger.error('Malformed message, discarding:', error);
              this.channel!.nack(msg, false, false);
              return;
            }

            const headers = (msg.properties.headers as Record<string, any>) || {};
            const retryCount = (headers['x-retry-count'] as number) || 0;

            if (retryCount >= maxRetries - 1) {
              logger.error(`Message failed after ${maxRetries} attempts, sending to DLQ`);
              this.channel!.nack(msg, false, false);
              return;
            }

            const nextRetry = retryCount + 1;
            try {
              const data = JSON.parse(msg.content.toString());
              this.channel!.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
                persistent: true,
                contentType: 'application/json',
                headers: { 'x-retry-count': nextRetry },
              });
              this.channel!.ack(msg);
              logger.warn(`Message requeued with retry ${nextRetry}/${maxRetries} via header`);
            } catch (e) {
              logger.error('Failed to requeue message:', e);
              this.channel!.nack(msg, false, false);
            }
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

      await this.channel.checkExchange('');
      return true;
    } catch (error) {
      return false;
    }
  }

  async reset(): Promise<void> {
    await this.close();
    this.connectionPromise = null;
  }
}
