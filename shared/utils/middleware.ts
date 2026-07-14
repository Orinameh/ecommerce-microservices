import type { Request, Response, NextFunction, RequestHandler } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import logger from './logger';
import { AppError } from './errors';

export function catchAsync<P = any, ResBody = any, ReqBody = any, ReqQuery = any, Locals extends Record<string, any> = Record<string, any>>(
  fn: (req: Request<P, ResBody, ReqBody, ReqQuery, Locals>, res: Response<ResBody, Locals>, next: NextFunction) => Promise<void>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals> {
  return (req, res, next) => {
    return fn(req, res, next).catch(next);
  };
}

type ServiceErrorHandler = (err: any, req: Request, res: Response) => boolean;

export function createSecurityMiddleware(
  corsOrigins: string[],
  allowedHeaders: string[] = ['Content-Type', 'Authorization', 'X-Request-Id']
) {
  return [
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
    compression(),
    cors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders,
      exposedHeaders: ['X-Request-Id'],
      credentials: true,
      maxAge: 86400,
    }),
    express.json({ limit: '10mb' }),
    express.urlencoded({ extended: true, limit: '10mb' }),
  ];
}

export function createRateLimiter(
  windowMs: number,
  max: number,
  message: string
) {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: `${windowMs / 60000} minutes`,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

export function createLoggingMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const requestId = (req as any).requestId || 'unknown';

    logger.info(`${req.method} ${req.originalUrl}`, {
      requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      contentType: req.get('content-type'),
    });

    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const level = statusCode >= 400 ? 'error' : 'info';

      logger[level](`${req.method} ${req.originalUrl} ${statusCode} ${duration}ms`, {
        requestId,
        statusCode,
        duration,
        contentLength: res.get('content-length'),
      });
    });

    next();
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = (req as any).requestId || 'unknown';

  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, { requestId });
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    requestId,
    timestamp: new Date().toISOString(),
  });
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId =
    req.get('X-Request-Id') || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  res.setHeader('X-Request-Id', requestId);
  (req as any).requestId = requestId;
  next();
}

export function createTimeoutMiddleware(timeout: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setTimeout(timeout, () => {
      const requestId = (req as any).requestId || 'unknown';
      logger.error(`Request timeout: ${req.method} ${req.originalUrl}`, { requestId });
      res.status(408).json({
        error: 'Request timeout',
        timeout: `${timeout}ms`,
        requestId,
        timestamp: new Date().toISOString(),
      });
    });
    next();
  };
}

export function createErrorHandler(serviceHandlers: ServiceErrorHandler[] = []) {
  return (err: any, req: Request, res: Response, next: NextFunction): void => {
    const requestId = (req as any).requestId || 'unknown';

    logger.error('Unhandled error:', {
      requestId,
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    for (const handler of serviceHandlers) {
      if (handler(err, req, res)) return;
    }

    const statusCode = err instanceof AppError ? err.statusCode : err.status || 500;
    const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
    res.status(statusCode).json({
      error: isProduction && statusCode === 500 ? 'Internal server error' : err.message,
      requestId,
      ...(isProduction && statusCode === 500 ? {} : { stack: err.stack }),
      timestamp: new Date().toISOString(),
    });
  };
}
