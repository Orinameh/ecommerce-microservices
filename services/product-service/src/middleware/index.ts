import { Request, Response } from 'express';
import { config } from '../config';
import {
  createSecurityMiddleware,
  createRateLimiter,
  createLoggingMiddleware,
  createErrorHandler,
  notFoundHandler,
  createTimeoutMiddleware,
} from '../../../../shared/utils/middleware';

const allowedHeaders = ['Content-Type', 'Authorization', 'X-Request-Id'];

export const securityMiddleware = createSecurityMiddleware(config.corsOrigins, allowedHeaders);

export const rateLimiter = createRateLimiter(
  config.rateLimit.windowMs,
  config.rateLimit.max,
  'Too many requests from this IP, please try again later.',
);

export const stockRateLimiter = createRateLimiter(
  60000,
  10,
  'Too many stock operations from this IP, please try again later.',
);

export const loggingMiddleware = createLoggingMiddleware(config.serviceName);

export const errorHandler = createErrorHandler([
  (err: any, req: Request, res: Response) => {
    if (err.code === 11000) {
      res.status(409).json({
        error: 'Duplicate key error',
        message: 'Resource already exists',
        requestId: (req as any).requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return true;
    }
    if (err.name === 'ValidationError') {
      res.status(400).json({
        error: 'Validation error',
        message: err.message,
        requestId: (req as any).requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return true;
    }
    return false;
  },
]);

export { notFoundHandler };

export const timeoutMiddleware = (timeout?: number) => createTimeoutMiddleware(timeout ?? config.timeout);

export const validateStockOperation = (req: Request, res: Response, next: any): void => {
  const { productId, quantity } = req.body;

  if (!productId) {
    res.status(400).json({ error: 'Missing productId', timestamp: new Date().toISOString() });
    return;
  }

  if (!quantity || quantity <= 0) {
    res.status(400).json({ error: 'Quantity must be greater than 0', timestamp: new Date().toISOString() });
    return;
  }

  next();
};
