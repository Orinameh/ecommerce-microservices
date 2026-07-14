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

const { OrderStatus, PaymentStatus } = await import('../../../../shared/utils/status');
const { OrderService } = await import('../services/order.service');

function createMocks() {
  const mockOrder = {
    _id: '507f1f77bcf86cd799439011',
    idempotencyKey: 'ik_test',
    customerId: 'cust_1',
    productId: 'prod_1',
    amount: 100,
    orderStatus: OrderStatus.PENDING,
  };

  const mockPaidOrder = { ...mockOrder, orderStatus: OrderStatus.PAID };

  const repo = {
    findByIdempotencyKey: mock(() => Promise.resolve(null)),
    findById: mock(() => Promise.resolve(mockPaidOrder)),
    create: mock(() => Promise.resolve(mockOrder)),
    updateStatus: mock(() => Promise.resolve(mockPaidOrder)),
    findAll: mock(() => Promise.resolve([mockOrder])),
  };

  const customerService = {
    validateCustomer: mock(() => Promise.resolve({ id: 'cust_1', name: 'John', email: 'john@example.com' })),
  };

  const productService = {
    validateProduct: mock(() => Promise.resolve({ id: 'prod_1', name: 'MacBook', price: 100, stock: 10 })),
    reserveStock: mock(() => Promise.resolve({ id: 'prod_1', stock: 9 })),
    releaseStock: mock(() => Promise.resolve({ id: 'prod_1', stock: 10 })),
  };

  const paymentService = {
    processPayment: mock(() => Promise.resolve({ status: PaymentStatus.SUCCESS, transactionId: 'txn_1' })),
  };

  return { repo, customerService, productService, paymentService, mockOrder, mockPaidOrder };
}

describe('OrderService', () => {
  test('createOrder succeeds with happy path', async () => {
    const mocks = createMocks();
    const service = new OrderService();
    (service as any).repository = mocks.repo;
    (service as any).customerService = mocks.customerService;
    (service as any).productService = mocks.productService;
    (service as any).paymentService = mocks.paymentService;

    const result = await service.createOrder({
      customerId: 'cust_1',
      productId: 'prod_1',
      amount: 100,
      quantity: 1,
    });

    expect(result.paymentStatus).toBe(PaymentStatus.SUCCESS);
    expect(mocks.repo.create).toHaveBeenCalled();
    expect(mocks.productService.reserveStock).toHaveBeenCalledWith('prod_1', 1);
    expect(mocks.paymentService.processPayment).toHaveBeenCalled();
    expect(mocks.repo.updateStatus).toHaveBeenCalledWith(
      mocks.mockOrder._id.toString(),
      OrderStatus.PAID
    );
  });

  test('createOrder passes productId to payment service', async () => {
    const mocks = createMocks();
    const service = new OrderService();
    (service as any).repository = mocks.repo;
    (service as any).customerService = mocks.customerService;
    (service as any).productService = mocks.productService;
    (service as any).paymentService = mocks.paymentService;

    await service.createOrder({
      customerId: 'cust_1',
      productId: 'prod_1',
      amount: 100,
    });

    expect(mocks.paymentService.processPayment).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod_1' })
    );
  });

  test('createOrder returns existing order on idempotent request', async () => {
    const mocks = createMocks();
    mocks.repo.findByIdempotencyKey = mock(() => Promise.resolve(mocks.mockPaidOrder));
    const service = new OrderService();
    (service as any).repository = mocks.repo;
    (service as any).customerService = mocks.customerService;
    (service as any).productService = mocks.productService;
    (service as any).paymentService = mocks.paymentService;

    const result = await service.createOrder({
      customerId: 'cust_1',
      productId: 'prod_1',
      amount: 100,
      idempotencyKey: 'ik_test',
    });

    expect(result.order.orderStatus).toBe(OrderStatus.PAID);
    expect(mocks.repo.create).not.toHaveBeenCalled();
    expect(mocks.productService.reserveStock).not.toHaveBeenCalled();
  });

  test('createOrder releases stock on payment failure response', async () => {
    const mocks = createMocks();
    mocks.paymentService.processPayment = mock(() =>
      Promise.resolve({ status: PaymentStatus.FAILED, transactionId: 'txn_1' })
    );
    const service = new OrderService();
    (service as any).repository = mocks.repo;
    (service as any).customerService = mocks.customerService;
    (service as any).productService = mocks.productService;
    (service as any).paymentService = mocks.paymentService;

    const result = await service.createOrder({
      customerId: 'cust_1',
      productId: 'prod_1',
      amount: 100,
    });

    expect(result.paymentStatus).toBe(PaymentStatus.FAILED);
    expect(mocks.productService.releaseStock).toHaveBeenCalledWith('prod_1', 1);
    expect(mocks.repo.updateStatus).toHaveBeenCalledWith(
      mocks.mockOrder._id.toString(),
      OrderStatus.FAILED
    );
  });

  test('createOrder releases stock on payment error', async () => {
    const mocks = createMocks();
    mocks.paymentService.processPayment = mock(() =>
      Promise.reject(new Error('Service unavailable'))
    );
    const service = new OrderService();
    (service as any).repository = mocks.repo;
    (service as any).customerService = mocks.customerService;
    (service as any).productService = mocks.productService;
    (service as any).paymentService = mocks.paymentService;

    const result = await service.createOrder({
      customerId: 'cust_1',
      productId: 'prod_1',
      amount: 100,
    });

    expect(result.paymentStatus).toBe(PaymentStatus.FAILED);
    expect(mocks.productService.releaseStock).toHaveBeenCalledWith('prod_1', 1);
  });

  test('createOrder throws on stock reservation failure', async () => {
    const mocks = createMocks();
    mocks.productService.reserveStock = mock(() =>
      Promise.reject(new Error('Insufficient stock'))
    );
    const service = new OrderService();
    (service as any).repository = mocks.repo;
    (service as any).customerService = mocks.customerService;
    (service as any).productService = mocks.productService;
    (service as any).paymentService = mocks.paymentService;

    expect(
      service.createOrder({ customerId: 'cust_1', productId: 'prod_1', amount: 100 })
    ).rejects.toThrow('Stock reservation failed');
  });

  test('createOrder throws on insufficient stock', async () => {
    const mocks = createMocks();
    mocks.productService.validateProduct = mock(() =>
      Promise.resolve({ id: 'prod_1', name: 'MacBook', price: 100, stock: 0 })
    );
    const service = new OrderService();
    (service as any).repository = mocks.repo;
    (service as any).customerService = mocks.customerService;
    (service as any).productService = mocks.productService;
    (service as any).paymentService = mocks.paymentService;

    expect(
      service.createOrder({ customerId: 'cust_1', productId: 'prod_1', amount: 100, quantity: 1 })
    ).rejects.toThrow('Insufficient stock');
  });

  test('updateOrderStatus enforces valid paid to cancelled transition', async () => {
    const mocks = createMocks();
    const service = new OrderService();
    (service as any).repository = mocks.repo;
    (service as any).customerService = mocks.customerService;
    (service as any).productService = mocks.productService;
    (service as any).paymentService = mocks.paymentService;

    await service.updateOrderStatus('507f1f77bcf86cd799439011', OrderStatus.CANCELLED);
    expect(mocks.repo.updateStatus).toHaveBeenCalledWith('507f1f77bcf86cd799439011', OrderStatus.CANCELLED);
  });

  test('updateOrderStatus rejects invalid transition from paid to pending', async () => {
    const repo = createMocks().repo;
    repo.findById = mock(() =>
      Promise.resolve({ _id: '507f1f77bcf86cd799439011', orderStatus: OrderStatus.PAID })
    );
    const service = new OrderService();
    (service as any).repository = repo;

    expect(
      service.updateOrderStatus('507f1f77bcf86cd799439011', OrderStatus.PENDING)
    ).rejects.toThrow("Cannot transition order from 'paid' to 'pending'");
  });

  test('getOrderById throws when not found', async () => {
    const repo = createMocks().repo;
    repo.findById = mock(() => Promise.resolve(null));
    const service = new OrderService();
    (service as any).repository = repo;

    expect(service.getOrderById('nonexistent')).rejects.toThrow('Order not found');
  });
});
