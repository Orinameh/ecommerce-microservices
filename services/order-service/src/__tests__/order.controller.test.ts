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

const { OrderController } = await import('../controllers/order.controller');

const mockOrder = { _id: '507f1f77bcf86cd799439011', customerId: 'cust_1', productId: 'prod_1', amount: 100, orderStatus: 'paid' };
const mockResult = { order: mockOrder, paymentStatus: 'success' };

function createReqRes() {
  const req: any = { params: {}, body: {}, headers: {}, ip: '127.0.0.1', get: () => {} };
  const res: any = {
    status: mock(() => res),
    json: mock(() => res),
    send: mock(() => res),
  };
  return { req, res };
}

function createController(overrides: Record<string, any> = {}) {
  const ctrl = new OrderController();
  (ctrl as any).service = {
    createOrder: mock(() => Promise.resolve(mockResult)),
    getOrderById: mock(() => Promise.resolve(mockOrder)),
    getAllOrders: mock(() => Promise.resolve([mockOrder])),
    updateOrderStatus: mock(() => Promise.resolve({ ...mockOrder, orderStatus: 'cancelled' })),
    ...overrides,
  };
  return ctrl;
}

describe('OrderController', () => {
  test('createOrder returns 201 with order details', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = { customerId: 'cust_1', productId: 'prod_1', amount: 100 };

    await ctrl.createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      customerId: 'cust_1',
      orderId: mockOrder._id,
      productId: 'prod_1',
      orderStatus: 'paid',
      paymentStatus: 'success',
    });
  });

  test('createOrder returns 400 when required fields missing', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = {};

    await ctrl.createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createOrder returns 409 on stock reservation failure', async () => {
    const ctrl = createController({ createOrder: mock(() => Promise.reject(new Error('Stock reservation failed: Out of stock'))) });
    const { req, res } = createReqRes();
    req.body = { customerId: 'cust_1', productId: 'prod_1', amount: 100 };

    await ctrl.createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('createOrder returns 500 on generic error', async () => {
    const ctrl = createController({ createOrder: mock(() => Promise.reject(new Error('Insufficient stock'))) });
    const { req, res } = createReqRes();
    req.body = { customerId: 'cust_1', productId: 'prod_1', amount: 100 };

    await ctrl.createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('getOrderById returns 200 with order', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.params = { id: '507f1f77bcf86cd799439011' };

    await ctrl.getOrderById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('getOrderById returns 404 when not found', async () => {
    const ctrl = createController({ getOrderById: mock(() => Promise.reject(new Error('Order not found'))) });
    const { req, res } = createReqRes();
    req.params = { id: 'nonexistent' };

    await ctrl.getOrderById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('updateOrderStatus returns 200 on success', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = { orderId: '507f1f77bcf86cd799439011', status: 'cancelled' };

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
