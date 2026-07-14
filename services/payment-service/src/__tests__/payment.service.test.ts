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

const { TransactionStatus } = await import('../../../../shared/utils/status');
const { PaymentService } = await import('../services/payment.service');

const mockTransaction = {
  _id: '507f1f77bcf86cd799439011',
  idempotencyKey: 'ik_test',
  customerId: 'cust_1',
  orderId: 'ord_1',
  amount: 100,
  status: TransactionStatus.PENDING,
};

function createMocks() {
  const repo = {
    findByIdempotencyKey: mock(() => Promise.resolve(null)),
    findById: mock(() => Promise.resolve(mockTransaction)),
    findAll: mock(() => Promise.resolve([mockTransaction])),
    create: mock(() => Promise.resolve(mockTransaction)),
    updateStatus: mock(() => Promise.resolve({ ...mockTransaction, status: TransactionStatus.COMPLETED })),
    updateProductId: mock(() => Promise.resolve({ ...mockTransaction, productId: 'prod_1' })),
  };

  const rabbitmq = {
    connect: mock(() => Promise.resolve()),
    publishTransaction: mock(() => Promise.resolve()),
    close: mock(() => Promise.resolve()),
  };

  return { repo, rabbitmq };
}

describe('PaymentService', () => {
  test('processPayment succeeds and publishes to RabbitMQ', async () => {
    const mocks = createMocks();
    const service = new PaymentService();
    (service as any).repository = mocks.repo;
    (service as any).rabbitmq = mocks.rabbitmq;

    const result = await service.processPayment({
      customerId: 'cust_1',
      orderId: 'ord_1',
      amount: 100,
      productId: 'prod_1',
    });

    expect(result.status).toBe('success');
    expect(mocks.repo.create).toHaveBeenCalled();
    expect(mocks.repo.updateStatus).toHaveBeenCalledWith(
      mockTransaction._id.toString(),
      TransactionStatus.COMPLETED
    );
    expect(mocks.repo.updateProductId).toHaveBeenCalledWith(
      mockTransaction._id.toString(),
      'prod_1'
    );
    expect(mocks.rabbitmq.publishTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust_1',
        orderId: 'ord_1',
        productId: 'prod_1',
        amount: 100,
      })
    );
  });

  test('processPayment handles idempotent request', async () => {
    const mocks = createMocks();
    mocks.repo.findByIdempotencyKey = mock(() =>
      Promise.resolve({ ...mockTransaction, status: TransactionStatus.COMPLETED })
    );
    const service = new PaymentService();
    (service as any).repository = mocks.repo;
    (service as any).rabbitmq = mocks.rabbitmq;

    const result = await service.processPayment({
      customerId: 'cust_1',
      orderId: 'ord_1',
      amount: 100,
      idempotencyKey: 'ik_test',
    });

    expect(result.status).toBe('success');
    expect(mocks.repo.create).not.toHaveBeenCalled();
    expect(mocks.rabbitmq.publishTransaction).not.toHaveBeenCalled();
  });

  test('getTransactionById returns transaction when found', async () => {
    const mocks = createMocks();
    const service = new PaymentService();
    (service as any).repository = mocks.repo;

    const result = await service.getTransactionById('507f1f77bcf86cd799439011');

    expect(result).toEqual(mockTransaction);
  });

  test('getTransactionById throws when not found', async () => {
    const mocks = createMocks();
    mocks.repo.findById = mock(() => Promise.resolve(null));
    const service = new PaymentService();
    (service as any).repository = mocks.repo;

    expect(service.getTransactionById('nonexistent')).rejects.toThrow('Transaction not found');
  });

  test('getAllTransactions returns all transactions', async () => {
    const mocks = createMocks();
    const service = new PaymentService();
    (service as any).repository = mocks.repo;

    const result = await service.getAllTransactions();
    expect(result).toEqual([mockTransaction]);
  });

  test('processPayment works without productId', async () => {
    const mocks = createMocks();
    const service = new PaymentService();
    (service as any).repository = mocks.repo;
    (service as any).rabbitmq = mocks.rabbitmq;

    const result = await service.processPayment({
      customerId: 'cust_1',
      orderId: 'ord_1',
      amount: 100,
    });

    expect(result.status).toBe('success');
    expect(mocks.repo.updateProductId).not.toHaveBeenCalled();
    expect(mocks.rabbitmq.publishTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ productId: undefined })
    );
  });
});
