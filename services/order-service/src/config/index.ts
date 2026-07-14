import { createConfig } from '../../../../shared/utils/config';

export const config = createConfig({
  port: 5003,
  serviceName: 'order-service',
  rateLimitMax: 50,
  extra: {
    customerServiceUrl: process.env.CUSTOMER_SERVICE_URL || 'http://customer-service:5001',
    productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://product-service:5002',
    paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:5004',
    rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672',
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.RETRY_DELAY || '5000'),
  },
});
