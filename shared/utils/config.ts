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
  return {
    port: parseInt(process.env.PORT || String(opts.port)),
    mongodbUri: process.env.MONGODB_URI || 'mongodb://admin:password@mongodb:27017/ecommerce?authSource=admin',
    nodeEnv: process.env.NODE_ENV || 'development',
    serviceName: opts.serviceName,
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      max: opts.rateLimitMax ?? parseInt(process.env.RATE_LIMIT_MAX || '100'),
    },
    timeout: parseInt(process.env.TIMEOUT_MS || '30000'),
    ...opts.extra,
  } as BaseConfig & T;
}
