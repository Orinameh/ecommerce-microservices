import { Request, Response } from 'express';
import { config } from '../config';
import {
  createSecurityMiddleware,
  createRateLimiter,
  createLoggingMiddleware,
  createErrorHandler,
  notFoundHandler,
  requestIdMiddleware,
  createTimeoutMiddleware,
} from '../../../../shared/utils/middleware';

const allowedHeaders = ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'];

export const securityMiddleware = createSecurityMiddleware(config.corsOrigins, allowedHeaders);

export const rateLimiter = createRateLimiter(
  config.rateLimit.windowMs,
  config.rateLimit.max,
  'Too many order requests from this IP, please try again later.',
);

export const loggingMiddleware = createLoggingMiddleware(config.serviceName);

export const errorHandler = createErrorHandler([
  (err: any, req: Request, res: Response) => {
    if (err.message?.includes('Insufficient stock')) {
      res.status(409).json({
        error: 'Insufficient stock',
        message: err.message,
        requestId: (req as any).requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return true;
    }
    return false;
  },
  (err: any, req: Request, res: Response) => {
    if (err.message?.includes('circuit open') || err.message?.includes('unavailable')) {
      res.status(503).json({
        error: 'Service temporarily unavailable',
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

export const idempotencyMiddleware = (req: Request, res: Response, next: any): void => {
  if (req.method === 'POST') {
    const idempotencyKey = (req.headers['idempotency-key'] as string) || (req.body as any).idempotencyKey;

    if (!idempotencyKey) {
      res.status(400).json({
        error: 'Missing idempotency key',
        message: 'Idempotency-Key header or idempotencyKey body field is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8) {
      res.status(400).json({
        error: 'Invalid idempotency key',
        message: 'Idempotency key must be a string >= 8 chars',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    (req as any).idempotencyKey = idempotencyKey;
    (req.body as any).idempotencyKey = idempotencyKey;
  }
  next();
};

export const validateOrderRequest = (req: Request, res: Response, next: any): void => {
  const { customerId, productId, amount, quantity } = req.body as any;
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;

  if (!customerId) {
    res.status(400).json({ error: 'Missing customerId', timestamp: new Date().toISOString() });
    return;
  }
  if (typeof customerId !== 'string' || !objectIdRegex.test(customerId)) {
    res.status(400).json({ error: 'Invalid customerId format', timestamp: new Date().toISOString() });
    return;
  }

  if (!productId) {
    res.status(400).json({ error: 'Missing productId', timestamp: new Date().toISOString() });
    return;
  }
  if (typeof productId !== 'string' || !objectIdRegex.test(productId)) {
    res.status(400).json({ error: 'Invalid productId format', timestamp: new Date().toISOString() });
    return;
  }

  if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
    res.status(400).json({ error: 'Amount must be greater than 0', timestamp: new Date().toISOString() });
    return;
  }

  if (quantity !== undefined) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      res.status(400).json({ error: 'Quantity must be a positive integer', timestamp: new Date().toISOString() });
      return;
    }
  }

  next();
};
