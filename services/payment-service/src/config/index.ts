import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5004'),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://admin:password@mongodb:27017/ecommerce?authSource=admin',
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'payment-service',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100')
  },
  timeout: parseInt(process.env.TIMEOUT_MS || '30000'),
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672',
  orderServiceUrl: process.env.ORDER_SERVICE_URL || 'http://order-service:5003',
  paymentTimeout: parseInt(process.env.PAYMENT_TIMEOUT || '10000'),
  transactionQueue: process.env.TRANSACTION_QUEUE || 'transaction_queue',
  deadLetterQueue: process.env.DEAD_LETTER_QUEUE || 'transaction_queue_dlq'
};