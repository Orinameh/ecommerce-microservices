import { describe, expect, test, mock } from 'bun:test';

mock.module('mongoose', () => {
  const Schema = class {};
  const model = () => ({});
  return {
    default: { Schema, model, connection: { readyState: 1, on: () => {} } },
    Schema,
    model,
  };
});

const { CustomerService } = await import('../services/customer.service');

const mockCustomer = {
  _id: '507f1f77bcf86cd799439011',
  name: 'John Doe',
  email: 'john.doe@example.com',
};

function createMockRepository() {
  return {
    findById: mock(() => Promise.resolve(mockCustomer)),
    findByEmail: mock(() => Promise.resolve(null)),
    findAll: mock(() => Promise.resolve([mockCustomer])),
    create: mock(() => Promise.resolve(mockCustomer)),
    update: mock(() => Promise.resolve(mockCustomer)),
    delete: mock(() => Promise.resolve(true)),
    seedDefaultCustomer: mock(() => Promise.resolve()),
  };
}

describe('CustomerService', () => {
  test('getCustomerById returns customer when found', async () => {
    const repo = createMockRepository();
    const service = new CustomerService();
    (service as any).repository = repo;

    const result = await service.getCustomerById('507f1f77bcf86cd799439011');

    expect(result).toEqual(mockCustomer);
    expect(repo.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  test('getCustomerById throws when not found', async () => {
    const repo = createMockRepository();
    repo.findById = mock(() => Promise.resolve(null));
    const service = new CustomerService();
    (service as any).repository = repo;

    expect(service.getCustomerById('nonexistent')).rejects.toThrow('Customer not found');
  });

  test('getAllCustomers returns all customers', async () => {
    const repo = createMockRepository();
    const service = new CustomerService();
    (service as any).repository = repo;

    const result = await service.getAllCustomers();

    expect(result).toEqual([mockCustomer]);
    expect(repo.findAll).toHaveBeenCalled();
  });

  test('createCustomer succeeds when email is unique', async () => {
    const repo = createMockRepository();
    repo.findByEmail = mock(() => Promise.resolve(null));
    const service = new CustomerService();
    (service as any).repository = repo;

    const result = await service.createCustomer({ name: 'Jane', email: 'jane@example.com' });

    expect(result).toEqual(mockCustomer);
    expect(repo.findByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(repo.create).toHaveBeenCalled();
  });

  test('createCustomer throws when email already exists', async () => {
    const repo = createMockRepository();
    repo.findByEmail = mock(() => Promise.resolve(mockCustomer));
    const service = new CustomerService();
    (service as any).repository = repo;

    expect(service.createCustomer({ name: 'Jane', email: 'john.doe@example.com' })).rejects.toThrow(
      'Customer with this email already exists'
    );
  });

  test('updateCustomer succeeds when customer exists', async () => {
    const repo = createMockRepository();
    const service = new CustomerService();
    (service as any).repository = repo;

    const result = await service.updateCustomer('507f1f77bcf86cd799439011', { name: 'Jane' });

    expect(result).toEqual(mockCustomer);
    expect(repo.update).toHaveBeenCalledWith('507f1f77bcf86cd799439011', { name: 'Jane' });
  });

  test('updateCustomer throws when not found', async () => {
    const repo = createMockRepository();
    repo.update = mock(() => Promise.resolve(null));
    const service = new CustomerService();
    (service as any).repository = repo;

    expect(service.updateCustomer('nonexistent', { name: 'Jane' })).rejects.toThrow('Customer not found');
  });

  test('deleteCustomer succeeds when customer exists', async () => {
    const repo = createMockRepository();
    const service = new CustomerService();
    (service as any).repository = repo;

    await service.deleteCustomer('507f1f77bcf86cd799439011');

    expect(repo.delete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  test('deleteCustomer throws when not found', async () => {
    const repo = createMockRepository();
    repo.delete = mock(() => Promise.resolve(false));
    const service = new CustomerService();
    (service as any).repository = repo;

    expect(service.deleteCustomer('nonexistent')).rejects.toThrow('Customer not found');
  });
});
