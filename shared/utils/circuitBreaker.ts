import logger from './logger';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenTimeout: number;
  serviceName: string;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface ServiceStats {
  failures: number;
  successes: number;
  totalRequests: number;
  failureRate: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private stats: ServiceStats = {
    failures: 0,
    successes: 0,
    totalRequests: 0,
    failureRate: 0
  };
  private halfOpenSuccesses: number = 0;
  private nextAttemptTime: number = 0;

  constructor(private options: CircuitBreakerOptions) {
    logger.info(`🔌 CircuitBreaker initialized for ${options.serviceName}`, {
      failureThreshold: options.failureThreshold,
      successThreshold: options.successThreshold,
      timeout: options.timeout
    });
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.stats.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if timeout has elapsed
      if (Date.now() < this.nextAttemptTime) {
        logger.warn(`⛔ Circuit OPEN for ${this.options.serviceName} - request rejected`);
        throw new Error(`Service ${this.options.serviceName} is currently unavailable (circuit open)`);
      }
      
      // Move to half-open state
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenSuccesses = 0;
      logger.info(`🔄 Circuit HALF-OPEN for ${this.options.serviceName} - attempting request`);
    }

    try {
      const result = await fn();
      this.handleSuccess();
      return result;
    } catch (error) {
      this.handleFailure(error);
      throw error;
    }
  }

  private handleSuccess(): void {
    this.stats.successes++;
    this.stats.lastSuccessTime = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      
      if (this.halfOpenSuccesses >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.stats.failures = 0;
        this.updateFailureRate();
        logger.info(`✅ Circuit CLOSED for ${this.options.serviceName} - service recovered`);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failures on success in CLOSED — sliding window would be better, but at least reset
      // Previously decremented by 1 which leaves stale count after 4 failures; now reset to 0
      this.stats.failures = 0;
      this.updateFailureRate();
    }
  }

  private isBusinessError(error: any): boolean {
    // 4xx (except 408,429,503) are business errors — don't trip circuit
    const status = error?.response?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      // 408 timeout, 429 too many, 503 unavailable are retryable — count them
      if (status === 408 || status === 429 || status === 503) return false;
      return true;
    }
    // AppError 400/404 from services
    if (error?.statusCode && error.statusCode >= 400 && error.statusCode < 500) return true;
    if (error?.status && error.status >= 400 && error.status < 500) return true;
    return false;
  }

  private handleFailure(error: any): void {
    // Don't count business 4xx as circuit failures
    if (this.isBusinessError(error)) {
      logger.debug(`CircuitBreaker ignoring business error for ${this.options.serviceName}: ${error.message}`);
      return;
    }
    this.stats.failures++;
    this.stats.lastFailureTime = new Date();
    this.updateFailureRate();

    logger.warn(`CircuitBreaker failure in ${this.options.serviceName}:`, {
      error: error.message,
      failures: this.stats.failures,
      failureRate: this.stats.failureRate
    });

    if (this.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      if (this.stats.failures >= this.options.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = Date.now() + this.options.halfOpenTimeout;
        logger.warn(`Circuit OPEN for ${this.options.serviceName} - service unavailable`);
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Failed in half-open state - reopen circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.halfOpenTimeout;
      logger.warn(`Circuit RE-OPENED for ${this.options.serviceName} - half-open test failed`);
    }
  }

  private updateFailureRate(): void {
    const total = this.stats.failures + this.stats.successes;
    this.stats.failureRate = total > 0 ? (this.stats.failures / total) * 100 : 0;
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): ServiceStats {
    return { ...this.stats };
  }
}

// Circuit Breaker Factory — thresholds configurable per service via second arg or env
export class CircuitBreakerFactory {
  private static circuits: Map<string, CircuitBreaker> = new Map();

  static getOrCreate(serviceName: string, overrides?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.circuits.has(serviceName)) {
      // Per-service tuning: payment is critical (lower threshold), product can be higher
      const defaults: Record<string, Partial<CircuitBreakerOptions>> = {
        'payment-service': { failureThreshold: 3, halfOpenTimeout: 30000 },
        'product-service': { failureThreshold: 5, halfOpenTimeout: 20000 },
        'customer-service': { failureThreshold: 5, halfOpenTimeout: 20000 },
        'order-service': { failureThreshold: 5, halfOpenTimeout: 20000 },
      };
      const perService = defaults[serviceName] || {};
      const circuit = new CircuitBreaker({
        serviceName,
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 10000,
        halfOpenTimeout: 30000,
        ...perService,
        ...overrides,
      });
      this.circuits.set(serviceName, circuit);
    }
    return this.circuits.get(serviceName)!;
  }

  static reset(serviceName: string): void {
    this.circuits.delete(serviceName);
    logger.info(`🔄 CircuitBreaker reset for ${serviceName}`);
  }

  static getAllStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    this.circuits.forEach((circuit, name) => {
      states[name] = circuit.getState();
    });
    return states;
  }
}

export const withCircuitBreaker = (serviceName: string, fn: () => Promise<any>, overrides?: Partial<CircuitBreakerOptions>) => {
  const circuit = CircuitBreakerFactory.getOrCreate(serviceName, overrides);
  return circuit.execute(fn);
};