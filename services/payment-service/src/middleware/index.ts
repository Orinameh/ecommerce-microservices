import { Request, Response } from 'express';
import { config } from '../config';
import {
  createSecurityMiddleware,
  createRateLimiter,
  createLoggingMiddleware,
  createErrorHandler,
  notFoundHandler,
  createTimeoutMiddleware,
  requestIdMiddleware,
} from '../../../../shared/utils/middleware';

const allowedHeaders = ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'];

export const securityMiddleware = createSecurityMiddleware(config.corsOrigins, allowedHeaders);

export const rateLimiter = createRateLimiter(
  config.rateLimit.windowMs,
  config.rateLimit.max,
  'Too many requests from this IP, please try again later.',
);

export const paymentRateLimiter = createRateLimiter(
  60000,
  20,
  'Too many payment requests from this IP, please try again later.',
);

export const loggingMiddleware = createLoggingMiddleware(config.serviceName);

export const errorHandler = createErrorHandler([
  (err: any, req: Request, res: Response) => {
    if (err.message?.includes('Payment declined')) {
      res.status(402).json({
        error: 'Payment declined',
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
        error: 'Payment service temporarily unavailable',
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
        message: 'Please provide idempotency-key header or field',
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

export const validatePaymentRequest = (req: Request, res: Response, next: any): void => {
  const { customerId, orderId, amount } = req.body as any;

  if (!customerId) {
    res.status(400).json({ error: 'Missing customerId', timestamp: new Date().toISOString() });
    return;
  }

  if (!orderId) {
    res.status(400).json({ error: 'Missing orderId', timestamp: new Date().toISOString() });
    return;
  }

  if (!amount || amount <= 0) {
    res.status(400).json({ error: 'Amount must be greater than 0', timestamp: new Date().toISOString() });
    return;
  }

  next();
};
