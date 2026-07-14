import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5002'),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://admin:password@mongodb:27017/ecommerce?authSource=admin',
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'product-service',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100')
  },
  timeout: parseInt(process.env.TIMEOUT_MS || '30000'),
  stockReservationTimeout: parseInt(process.env.STOCK_RESERVATION_TIMEOUT || '60000') // 1 minute
};