import { HttpClientFactory } from '../../../../shared/utils/httpClient';
import { config } from '../config/index';

export interface PaymentRequest {
  idempotencyKey: string;
  customerId: string;
  orderId: string;
  amount: number;
}

export interface PaymentResponse {
  status: string;
  transactionId: string;
}

export class PaymentService {
  private client = HttpClientFactory.getClient({
    baseURL: config.paymentServiceUrl,
    serviceName: 'payment-service',
    timeout: 5000,
    maxRetries: 2,
    retryDelay: 1000
  });

  async processPayment(data: PaymentRequest): Promise<PaymentResponse> {
    return await this.client.post<PaymentResponse>('/api/payments/process', data);
  }
}
