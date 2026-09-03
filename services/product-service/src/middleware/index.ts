import { Request, Response } from 'express';
import { config } from '../config';
import { MONGO_DUPLICATE_KEY_ERROR } from '../../../../shared/utils/errors';
import {
  createSecurityMiddleware,
  createRateLimiter,
  createLoggingMiddleware,
  createErrorHandler,
  notFoundHandler,
  createTimeoutMiddleware,
  requestIdMiddleware,
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
    if (err.code === MONGO_DUPLICATE_KEY_ERROR) {
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

export { notFoundHandler, requestIdMiddleware };

export const timeoutMiddleware = (timeout?: number) => createTimeoutMiddleware(timeout ?? config.timeout);

export const validateStockOperation = (req: Request, res: Response, next: any): void => {
  const { productId, quantity } = req.body;
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;

  if (!productId) {
    res.status(400).json({ error: 'Missing productId', timestamp: new Date().toISOString() });
    return;
  }
  if (typeof productId !== 'string' || !objectIdRegex.test(productId)) {
    res.status(400).json({ error: 'Invalid productId format', timestamp: new Date().toISOString() });
    return;
  }

  if (quantity === undefined || quantity === null) {
    res.status(400).json({ error: 'Missing quantity', timestamp: new Date().toISOString() });
    return;
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    res.status(400).json({ error: 'Quantity must be a positive integer', timestamp: new Date().toISOString() });
    return;
  }

  next();
};
