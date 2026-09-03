import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { withRetry } from './retry';
import { withCircuitBreaker } from './circuitBreaker';
import logger from './logger';

export interface HttpClientConfig {
  baseURL: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  serviceName: string;
  circuitBreaker?: { failureThreshold?: number; successThreshold?: number; halfOpenTimeout?: number };
}

export class HttpClient {
  private client: AxiosInstance;
  private serviceName: string;
  private maxRetries: number;
  private retryDelay: number;
  private circuitOverrides?: { failureThreshold?: number; successThreshold?: number; halfOpenTimeout?: number };

  constructor(config: HttpClientConfig) {
    this.serviceName = config.serviceName;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 500;
    this.circuitOverrides = config.circuitBreaker;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 5000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`📤 ${this.serviceName} Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error(`${this.serviceName} Request Error:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`📥 ${this.serviceName} Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`${this.serviceName} Response Error:`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  // Generic GET with retry and circuit breaker
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const result = await withCircuitBreaker(this.serviceName, async () => {
        return await withRetry(
          async () => {
            const response = await this.client.get<T>(url, config);
            return response.data;
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelay,
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'NetworkError', '503']
          },
          `${this.serviceName} GET ${url}`
        );
      }, this.circuitOverrides);
      return result;
    } catch (error) {
      this.handleError(error, 'GET', url);
      throw error;
    }
  }

  // Generic POST with retry and circuit breaker - non-idempotent POSTs are not retried unless Idempotency-Key present
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const hasIdempotencyKey = !!(
      (config?.headers as any)?.['Idempotency-Key'] ||
      (config?.headers as any)?.['idempotency-key'] ||
      (data as any)?.idempotencyKey
    );
    const effectiveRetries = hasIdempotencyKey ? this.maxRetries : 1;
    try {
      const result = await withCircuitBreaker(this.serviceName, async () => {
        return await withRetry(
          async () => {
            const response = await this.client.post<T>(url, data, config);
            return response.data;
          },
          {
            maxRetries: effectiveRetries,
            initialDelay: this.retryDelay,
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'NetworkError', '503']
          },
          `${this.serviceName} POST ${url}`
        );
      }, this.circuitOverrides);
      return result;
    } catch (error) {
      this.handleError(error, 'POST', url);
      throw error;
    }
  }

  // Generic PUT with retry and circuit breaker
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const result = await withCircuitBreaker(this.serviceName, async () => {
        return await withRetry(
          async () => {
            const response = await this.client.put<T>(url, data, config);
            return response.data;
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelay,
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'NetworkError', '503']
          },
          `${this.serviceName} PUT ${url}`
        );
      }, this.circuitOverrides);
      return result;
    } catch (error) {
      this.handleError(error, 'PUT', url);
      throw error;
    }
  }

  // Generic DELETE with retry and circuit breaker
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const result = await withCircuitBreaker(this.serviceName, async () => {
        return await withRetry(
          async () => {
            const response = await this.client.delete<T>(url, config);
            return response.data;
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelay,
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'NetworkError', '503']
          },
          `${this.serviceName} DELETE ${url}`
        );
      }, this.circuitOverrides);
      return result;
    } catch (error) {
      this.handleError(error, 'DELETE', url);
      throw error;
    }
  }

  // Raw request with full control
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const result = await withCircuitBreaker(this.serviceName, async () => {
        return await withRetry(
          async () => {
            const response = await this.client.request<T>(config);
            return response.data;
          },
          {
            maxRetries: this.maxRetries,
            initialDelay: this.retryDelay,
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'NetworkError', '503']
          },
          `${this.serviceName} ${config.method?.toUpperCase()} ${config.url}`
        );
      }, this.circuitOverrides);
      return result;
    } catch (error) {
      this.handleError(error, config.method?.toUpperCase() || 'REQUEST', config.url || 'unknown');
      throw error;
    }
  }

  private handleError(error: any, method: string, url: string): void {
    if (error.response) {
      // The request was made and the server responded with a status code
      logger.error(`${this.serviceName} ${method} ${url} failed:`, {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      // The request was made but no response was received
      logger.error(`${this.serviceName} ${method} ${url} no response:`, error.message);
    } else {
      // Something happened in setting up the request
      logger.error(`${this.serviceName} ${method} ${url} error:`, error.message);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health', { timeout: 2000 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Factory for creating HTTP clients
export class HttpClientFactory {
  private static clients: Map<string, HttpClient> = new Map();

  static getClient(config: HttpClientConfig): HttpClient {
    const key = `${config.serviceName}-${config.baseURL}`;
    if (!this.clients.has(key)) {
      this.clients.set(key, new HttpClient(config));
    }
    return this.clients.get(key)!;
  }

  static clearAll(): void {
    this.clients.clear();
  }
}