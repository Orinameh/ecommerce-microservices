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

const { AppError } = await import('../../../../shared/utils/errors');
const { OrderStatus, PaymentStatus } = await import('../../../../shared/utils/status');
const { OrderController } = await import('../controllers/order.controller');

const mockOrder = { _id: '507f1f77bcf86cd799439011', customerId: 'cust_1', productId: 'prod_1', amount: 100, orderStatus: OrderStatus.PAID };
const mockResult = { order: mockOrder, paymentStatus: PaymentStatus.SUCCESS };

function createReqRes() {
  const req: any = { params: {}, body: {}, headers: {}, ip: '127.0.0.1', get: () => {} };
  const next: any = mock(() => {});
  const res: any = {
    status: mock(() => res),
    json: mock(() => res),
    send: mock(() => res),
  };
  return { req, res, next };
}

function createController(overrides: Record<string, any> = {}) {
  const ctrl = new OrderController();
  (ctrl as any).service = {
    createOrder: mock(() => Promise.resolve(mockResult)),
    getOrderById: mock(() => Promise.resolve(mockOrder)),
    getAllOrders: mock(() => Promise.resolve([mockOrder])),
    updateOrderStatus: mock(() => Promise.resolve({ ...mockOrder, orderStatus: OrderStatus.CANCELLED })),
    ...overrides,
  };
  return ctrl;
}

describe('OrderController', () => {
  test('createOrder returns 201 with order details', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = { customerId: 'cust_1', productId: 'prod_1', amount: 100, idempotencyKey: 'ik_test_order_123' };
    (req as any).idempotencyKey = 'ik_test_order_123';

    await ctrl.createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      customerId: 'cust_1',
      orderId: mockOrder._id,
      productId: 'prod_1',
      orderStatus: OrderStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
    });
  });

  test('createOrder forwards error when required fields missing', async () => {
    const ctrl = createController({
      createOrder: mock(() => Promise.reject(new Error('Idempotency key is required'))),
    });
    const { req, res, next } = createReqRes();
    req.body = {};

    await ctrl.createOrder(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('createOrder returns 409 on stock reservation failure', async () => {
    const ctrl = createController({ createOrder: mock(() => Promise.reject(new AppError('Stock reservation failed: Out of stock', 409))) });
    const { req, res, next } = createReqRes();
    req.body = { customerId: 'cust_1', productId: 'prod_1', amount: 100 };

    await ctrl.createOrder(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Stock reservation failed: Out of stock', statusCode: 409 }));
  });

  test('createOrder returns 500 on generic error', async () => {
    const ctrl = createController({ createOrder: mock(() => Promise.reject(new Error('Insufficient stock'))) });
    const { req, res, next } = createReqRes();
    req.body = { customerId: 'cust_1', productId: 'prod_1', amount: 100 };

    await ctrl.createOrder(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Insufficient stock' }));
  });

  test('getOrderById returns 200 with order', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.params = { id: '507f1f77bcf86cd799439011' };

    await ctrl.getOrderById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('getOrderById returns 404 when not found', async () => {
    const ctrl = createController({ getOrderById: mock(() => Promise.reject(new AppError('Order not found', 404))) });
    const { req, res, next } = createReqRes();
    req.params = { id: 'nonexistent' };

    await ctrl.getOrderById(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Order not found', statusCode: 404 }));
  });

  test('updateOrderStatus returns 200 on success', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = { orderId: '507f1f77bcf86cd799439011', status: OrderStatus.CANCELLED };

    await ctrl.updateOrderStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('updateOrderStatus returns 400 when fields missing', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = {};

    await ctrl.updateOrderStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updateOrderStatus returns 400 on invalid status', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = { orderId: 'oid', status: 'bogus' };

    await ctrl.updateOrderStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
