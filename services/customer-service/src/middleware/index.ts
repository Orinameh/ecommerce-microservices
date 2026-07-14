import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from '../../../../shared/utils/logger.js';

export const securityMiddleware = [
  helmet(),
  compression(),
  cors(),
  express.json({ limit: '10mb' }),
  express.urlencoded({ extended: true, limit: '10mb' })
];

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Logging middleware
export const loggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const logLevel = statusCode >= 400 ? 'error' : 'info';
    
    logger[logLevel](`${req.method} ${req.originalUrl} ${statusCode} ${duration}ms`, {
      statusCode,
      duration,
      contentLength: res.get('content-length')
    });
  });

  next();
};

// Error handler middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(err.status || 500).json({
    error: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
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
export const timeoutMiddleware = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setTimeout(timeout, () => {
      logger.error(`Request timeout: ${req.method} ${req.originalUrl}`);
      res.status(408).json({
        error: 'Request timeout',
        timeout: `${timeout}ms`,
        timestamp: new Date().toISOString()
      });
    });
    next();
  };
};