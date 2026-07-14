import logger from './logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableErrors?: string[];
}

export class RetryHandler {
  private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'NetworkError', '503']
  };

  static async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
    context: string = 'operation'
  ): Promise<T> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;
    let delay = opts.initialDelay;

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        logger.info(`Attempt ${attempt}/${opts.maxRetries} for ${context}`);
        return await fn();
      } catch (error: any) {
        lastError = error;

        const isRetryable = opts.retryableErrors.some(err => 
          error.message?.includes(err) || 
          error.code?.includes(err) ||
          error.response?.status?.toString() === err
        );

        if (!isRetryable || attempt === opts.maxRetries) {
          logger.error(`${context} failed after ${attempt} attempts:`, error.message);
          throw error;
        }

        logger.warn(`${context} failed (attempt ${attempt}), retrying in ${delay}ms...`, {
          error: error.message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
      }
    }

    throw lastError || new Error(`Failed ${context} after ${opts.maxRetries} attempts`);
  }
}

export const withRetry = RetryHandler.execute.bind(RetryHandler);
