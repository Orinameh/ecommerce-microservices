import express from 'express';
import { Database } from '../../../shared/utils/database';
import { config } from './config/index';
import { 
  securityMiddleware, 
  rateLimiter, 
  loggingMiddleware, 
  errorHandler,
  notFoundHandler,
  requestIdMiddleware,
  timeoutMiddleware
} from './middleware/index';
import customerRoutes from './routes/customerRoutes';
import { CustomerService } from './services/CustomerService';
import logger from '../../../shared/utils/logger';

const app = express();

// Apply middleware
app.use(requestIdMiddleware);
app.use(securityMiddleware);
app.use(rateLimiter);
app.use(loggingMiddleware);
app.use(timeoutMiddleware(30000));

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: config.serviceName,
    database: Database.getInstance().isConnectedToDatabase(),
    timestamp: new Date().toISOString()
  });
});

app.use('/api', customerRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await Database.getInstance().connect(config.mongodbUri);
    
    // Seed default data
    const customerService = new CustomerService();
    await customerService.seedDefaultCustomer();

    // Start listening
    app.listen(config.port, () => {
      logger.info(`${config.serviceName} running on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Shutting down...');
  await Database.getInstance().disconnect();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);