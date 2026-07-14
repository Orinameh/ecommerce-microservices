import express from 'express';
import { Database } from '../../../shared/utils/database';
import { config } from './config';
import {
  securityMiddleware,
  rateLimiter,
  loggingMiddleware,
  errorHandler,
  notFoundHandler,
  requestIdMiddleware,
  timeoutMiddleware
} from './middleware';
import orderRoutes from './routes/order.route';
import logger from '../../../shared/utils/logger';

const app = express();

app.use(requestIdMiddleware);
app.use(securityMiddleware);
app.use(rateLimiter);
app.use(loggingMiddleware);
app.use(timeoutMiddleware(30000));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: config.serviceName,
    database: Database.getInstance().isConnectedToDatabase(),
    timestamp: new Date().toISOString()
  });
});

app.use('/api', orderRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    await Database.getInstance().connect(config.mongodbUri);

    app.listen(config.port, () => {
      logger.info(`${config.serviceName} running on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

const gracefulShutdown = async () => {
  logger.info('Shutting down...');
  await Database.getInstance().disconnect();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
