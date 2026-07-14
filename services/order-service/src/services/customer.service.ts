import { AppError } from '../../../../shared/utils/errors';
import { HttpClientFactory } from '../../../../shared/utils/httpClient';
import { config } from '../config';

export interface Customer {
  id: string;
  name: string;
  email: string;
}

export class CustomerService {

  private client = HttpClientFactory.getClient({
    baseURL: config.customerServiceUrl,
    serviceName: 'customer-service',
    timeout: 3000,
    maxRetries: 3,
    retryDelay: 500
  });

  async validateCustomer(customerId: string): Promise<Customer> {
    try {
      return await this.client.get<Customer>(`/api/customers/${customerId}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new AppError(`Customer not found: ${customerId}`, 404);
      }
      throw error;
    }
  }
}
