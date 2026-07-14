import { createConfig } from '../../../../shared/utils/config';

export const config = createConfig({
  port: 5004,
  serviceName: 'payment-service',
  extra: {
    rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672',
    orderServiceUrl: process.env.ORDER_SERVICE_URL || 'http://order-service:5003',
    paymentTimeout: parseInt(process.env.PAYMENT_TIMEOUT || '10000'),
    transactionQueue: process.env.TRANSACTION_QUEUE || 'transaction_queue',
    deadLetterQueue: process.env.DEAD_LETTER_QUEUE || 'transaction_queue_dlq',
  },
});
