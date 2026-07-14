import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5003'),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://admin:password@mongodb:27017/ecommerce?authSource=admin',
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'order-service',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX || '50') // Stricter for orders
  },
  timeout: parseInt(process.env.TIMEOUT_MS || '30000'),
  customerServiceUrl: process.env.CUSTOMER_SERVICE_URL || 'http://customer-service:5001',
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://product-service:5002',
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:5004',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672',
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.RETRY_DELAY || '5000')
};