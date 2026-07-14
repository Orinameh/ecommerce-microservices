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
    return await this.client.get<Customer>(`/api/customers/${customerId}`);
  }
}
