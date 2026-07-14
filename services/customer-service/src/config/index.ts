import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5001,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://admin:password@mongodb:27017/ecommerce?authSource=admin',
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'customer-service'
};