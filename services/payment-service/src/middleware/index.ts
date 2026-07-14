import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import logger from '../../../../shared/utils/logger';

// Security middleware
export const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
  compression(),
  cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 86400
  }),
  express.json({ limit: '10mb' }),
  express.urlencoded({ extended: true, limit: '10mb' })
];

// Rate limiter
export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: `${config.rateLimit.windowMs / 60000} minutes`
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  }
});

// Payment-specific rate limiter (stricter)
export const paymentRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 20, // 20 payment requests per minute
  message: {
    error: 'Too many payment requests from this IP, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Idempotency middleware for payments
export const idempotencyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'POST') {
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
    
    if (!idempotencyKey) {
      res.status(400).json({
        error: 'Missing idempotency key',
        message: 'Please provide idempotency-key header or field',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    (req as any).idempotencyKey = idempotencyKey;
  }
  next();
};

// Logging middleware
export const loggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const requestId = (req as any).requestId || 'unknown';
  
  logger.info(`${req.method} ${req.originalUrl}`, {
    requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    contentType: req.get('content-type'),
    idempotencyKey: req.headers['idempotency-key'] || req.body.idempotencyKey
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const logLevel = statusCode >= 400 ? 'error' : 'info';
    
    logger[logLevel](`${req.method} ${req.originalUrl} ${statusCode} ${duration}ms`, {
      requestId,
      statusCode,
      duration,
      contentLength: res.get('content-length')
    });
  });

  next();
};

// Error handler middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req as any).requestId || 'unknown';
  
  logger.error('Unhandled error:', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  const isProduction = config.nodeEnv === 'production';
  
  // Handle specific error types
  if (err.message?.includes('Payment declined')) {
    res.status(402).json({
      error: 'Payment declined',
      message: err.message,
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (err.message?.includes('circuit open') || err.message?.includes('unavailable')) {
    res.status(503).json({
      error: 'Payment service temporarily unavailable',
      message: err.message,
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  res.status(err.status || 500).json({
    error: isProduction ? 'Internal server error' : err.message,
    requestId,
    ...(isProduction ? {} : { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = (req as any).requestId || 'unknown';
  
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, { requestId });
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    requestId,
    timestamp: new Date().toISOString()
  });
};

// Request ID middleware
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.get('X-Request-Id') || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  res.setHeader('X-Request-Id', requestId);
  (req as any).requestId = requestId;
  next();
};

// Timeout middleware
export const timeoutMiddleware = (timeout: number = config.timeout) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setTimeout(timeout, () => {
      const requestId = (req as any).requestId || 'unknown';
      logger.error(`Request timeout: ${req.method} ${req.originalUrl}`, { requestId });
      res.status(408).json({
        error: 'Request timeout',
        timeout: `${timeout}ms`,
        requestId,
        timestamp: new Date().toISOString()
      });
    });
    next();
  };
};

// Validate payment request
export const validatePaymentRequest = (req: Request, res: Response, next: NextFunction): void => {
  const { customerId, orderId, amount } = req.body;
  
  if (!customerId) {
    res.status(400).json({
      error: 'Missing customerId',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (!orderId) {
    res.status(400).json({
      error: 'Missing orderId',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (!amount || amount <= 0) {
    res.status(400).json({
      error: 'Amount must be greater than 0',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};