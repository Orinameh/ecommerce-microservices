import logger from './logger.ts';

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
        logger.info(`✅ Circuit CLOSED for ${this.options.serviceName} - service recovered`);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reduce failure count on success
      this.stats.failures = Math.max(0, this.stats.failures - 1);
      this.updateFailureRate();
    }
  }

  private handleFailure(error: any): void {
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

// Circuit Breaker Factory
export class CircuitBreakerFactory {
  private static circuits: Map<string, CircuitBreaker> = new Map();

  static getOrCreate(serviceName: string): CircuitBreaker {
    if (!this.circuits.has(serviceName)) {
      const circuit = new CircuitBreaker({
        serviceName,
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 10000,
        halfOpenTimeout: 30000
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

export const withCircuitBreaker = (serviceName: string, fn: () => Promise<any>) => {
  const circuit = CircuitBreakerFactory.getOrCreate(serviceName);
  return circuit.execute(fn);
};