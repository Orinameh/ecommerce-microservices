import mongoose from 'mongoose';
import logger from './logger';

export class Database {
  private static instance: Database | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(uri: string): Promise<void> {
    // Use mongoose readyState as source of truth (1 = connected)
    if (mongoose.connection.readyState === 1) {
      this.isConnected = true;
      logger.info('Database already connected');
      return;
    }
    if (mongoose.connection.readyState === 2) {
      // connecting - wait for existing promise if any
      if (this.connectionPromise) {
        await this.connectionPromise;
        return;
      }
    }

    // If connection is in progress, wait for it
    if (this.connectionPromise) {
      await this.connectionPromise;
      return;
    }

    // Start connection
    this.connectionPromise = this.doConnect(uri);
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async doConnect(uri: string): Promise<void> {
    try {
      mongoose.set('bufferCommands', false);

      await mongoose.connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
      } as mongoose.ConnectOptions);

      this.isConnected = true;
      logger.info('Database connected successfully');
      
      // Setup connection event handlers (once to avoid duplicate listeners)
      if (mongoose.connection.listenerCount('error') === 0) {
        mongoose.connection.on('error', (error) => {
          logger.error('Database connection error:', error);
          this.isConnected = false;
          this.connectionPromise = null;
        });

        mongoose.connection.on('disconnected', () => {
          logger.warn('Database disconnected');
          this.isConnected = false;
          this.connectionPromise = null;
        });

        mongoose.connection.on('reconnected', () => {
          logger.info('Database reconnected');
          this.isConnected = true;
        });

        mongoose.connection.on('close', () => {
          logger.warn('Database connection closed');
          this.isConnected = false;
          this.connectionPromise = null;
        });
      }

    } catch (error) {
      logger.error('Database connection failed:', error);
      this.isConnected = false;
      this.connectionPromise = null;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected && mongoose.connection.readyState === 0) {
      logger.info('Database already disconnected');
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting database:', error);
      throw error;
    }
  }

  isConnectedToDatabase(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  getConnectionState(): string {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    return states[mongoose.connection.readyState] || 'unknown';
  }

  // Reset connection (for testing)
  async reset(): Promise<void> {
    await this.disconnect();
    this.connectionPromise = null;
  }
}