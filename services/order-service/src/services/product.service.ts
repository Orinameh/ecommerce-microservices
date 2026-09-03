import { AppError } from '../../../../shared/utils/errors';
import { HttpClientFactory } from '../../../../shared/utils/httpClient';
import { config } from '../config/index';

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export class ProductService {
  private client = HttpClientFactory.getClient({
    baseURL: config.productServiceUrl,
    serviceName: 'product-service',
    timeout: 3000,
    maxRetries: 3,
    retryDelay: 500
  });

  async validateProduct(productId: string): Promise<Product> {
    try {
      return await this.client.get<Product>(`/api/products/${productId}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new AppError(`Product not found: ${productId}`, 404);
      }
      throw error;
    }
  }

  async reserveStock(productId: string, quantity: number, idempotencyKey?: string): Promise<Product> {
    try {
      return await this.client.post<Product>(`/api/products/reserve`, {
        productId,
        quantity,
        idempotencyKey
      }, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } as any : undefined);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new AppError(`Product not found: ${productId}`, 404);
      }
      throw error;
    }
  }

  async releaseStock(productId: string, quantity: number, idempotencyKey?: string): Promise<Product> {
    try {
      return await this.client.post<Product>(`/api/products/release`, {
        productId,
        quantity,
        idempotencyKey
      }, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } as any : undefined);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new AppError(`Product not found: ${productId}`, 404);
      }
      throw error;
    }
  }
}
