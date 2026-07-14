import { Request, Response } from 'express';
import { config } from '../config';
import { MONGO_DUPLICATE_KEY_ERROR } from '../../../../shared/utils/errors';
import {
  createSecurityMiddleware,
  createRateLimiter,
  createLoggingMiddleware,
  createErrorHandler,
  notFoundHandler,
  requestIdMiddleware,
  createTimeoutMiddleware,
} from '../../../../shared/utils/middleware';

const allowedHeaders = ['Content-Type', 'Authorization', 'X-Request-Id'];

export const securityMiddleware = createSecurityMiddleware(config.corsOrigins, allowedHeaders);

export const rateLimiter = createRateLimiter(
  config.rateLimit.windowMs,
  config.rateLimit.max,
  'Too many requests from this IP, please try again later.',
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
