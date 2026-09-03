import dotenv from 'dotenv';
dotenv.config();

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

interface BaseConfig {
  port: number;
  mongodbUri: string;
  nodeEnv: string;
  serviceName: string;
  logLevel: string;
  corsOrigins: string[];
  rateLimit: RateLimitConfig;
  timeout: number;
}

interface CreateConfigOptions<T extends Record<string, unknown> = Record<string, never>> {
  port: number;
  serviceName: string;
  rateLimitMax?: number;
  extra?: T;
}

export function createConfig<T extends Record<string, unknown> = Record<string, never>>(
  opts: CreateConfigOptions<T>,
): BaseConfig & T {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  // In production, MONGODB_URI is strictly required
  if (isProd && !process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be set in production');
  }
  if (isProd && !process.env.CORS_ORIGINS) {
    throw new Error('CORS_ORIGINS must be set in production (comma-separated allowlist)');
  }

  // For dev/test, allow fallback without hardcoding real credentials in source
  // The actual URI is injected via .env / docker-compose env
  const mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';
  if (isProd && mongodbUri.includes('admin:password')) {
    throw new Error('Default MongoDB credentials cannot be used in production');
  }
  if (mongodbUri.includes('admin:password')) {
    console.warn('WARNING: Default MongoDB credentials detected - use strong credentials in production');
  }

  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean)
    || (isProd ? [] : ['*']);

  return {
    port: parseInt(process.env.PORT || String(opts.port)),
    mongodbUri,
    nodeEnv,
    serviceName: opts.serviceName,
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigins,
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      max: opts.rateLimitMax ?? parseInt(process.env.RATE_LIMIT_MAX || '100'),
    },
    timeout: parseInt(process.env.TIMEOUT_MS || '30000'),
    ...opts.extra,
  } as BaseConfig & T;
}
