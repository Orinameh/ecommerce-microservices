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
    const idempotencyKey = req.headers['idempotency-key'] || (req.body as any).idempotencyKey;

    if (!idempotencyKey) {
      (req as any).generatedIdempotencyKey = `ik_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      (req.body as any).idempotencyKey = (req as any).generatedIdempotencyKey;
    } else {
      (req as any).idempotencyKey = idempotencyKey;
    }
  }
  next();
};

export const validateOrderRequest = (req: Request, res: Response, next: any): void => {
  const { customerId, productId, amount, quantity } = req.body as any;

  if (!customerId) {
    res.status(400).json({ error: 'Missing customerId', timestamp: new Date().toISOString() });
    return;
  }

  if (!productId) {
    res.status(400).json({ error: 'Missing productId', timestamp: new Date().toISOString() });
    return;
  }

  if (!amount || amount <= 0) {
    res.status(400).json({ error: 'Amount must be greater than 0', timestamp: new Date().toISOString() });
    return;
  }

  if (quantity && quantity <= 0) {
    res.status(400).json({ error: 'Quantity must be greater than 0', timestamp: new Date().toISOString() });
    return;
  }

  next();
};
