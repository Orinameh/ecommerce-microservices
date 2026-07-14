import express from 'express';
import { Database } from '../../../shared/utils/database';
import { config } from './config';
import { securityMiddleware, rateLimiter, loggingMiddleware, errorHandler, notFoundHandler } from './middleware';
import paymentRoutes from './routes/payment.route';
import { PaymentService } from './services/payment.service';
import logger from '../../../shared/utils/logger';

const app = express();
let paymentService: PaymentService;

app.use(securityMiddleware);
app.use(rateLimiter);
app.use(loggingMiddleware);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: config.serviceName,
    database: Database.getInstance().isConnectedToDatabase()
  });
});

app.use('/api', paymentRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    await Database.getInstance().connect(config.mongodbUri);

    paymentService = new PaymentService();
    await paymentService.initRabbitMQ();

    app.listen(config.port, () => {
      logger.info(`${config.serviceName} running on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', async () => {
  logger.info('Shutting down payment service...');
  await paymentService?.closeRabbitMQ();
  await Database.getInstance().disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down payment service...');
  await paymentService?.closeRabbitMQ();
  await Database.getInstance().disconnect();
  process.exit(0);
});
