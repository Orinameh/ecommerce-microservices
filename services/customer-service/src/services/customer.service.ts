import { CustomerRepository } from '../repositories/customer.repository';
import { ICustomer } from '../models/customer.model';

export class CustomerService {
  private repository: CustomerRepository;

  constructor() {
    this.repository = new CustomerRepository();
  }

  async getCustomerById(id: string): Promise<ICustomer> {
    const customer = await this.repository.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }
    return customer;
  }

  async getAllCustomers(): Promise<ICustomer[]> {
    return await this.repository.findAll();
  }

  async createCustomer(data: Partial<ICustomer>): Promise<ICustomer> {
    const existing = await this.repository.findByEmail(data.email!);
    if (existing) {
      throw new Error('Customer with this email already exists');
    }
    return await this.repository.create(data);
  }

  async updateCustomer(id: string, data: Partial<ICustomer>): Promise<ICustomer> {
    const customer = await this.repository.update(id, data);
    if (!customer) {
      throw new Error('Customer not found');
    }
    return customer;
  }

  async deleteCustomer(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new Error('Customer not found');
    }
  }

  async seedDefaultCustomer(): Promise<void> {
    await this.repository.seedDefaultCustomer();
  }
}