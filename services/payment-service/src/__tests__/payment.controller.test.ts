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
const { PaymentController } = await import('../controllers/payment.controller');

const mockResult = { status: 'success', transactionId: 'txn_1' };

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
  const ctrl = new PaymentController();
  (ctrl as any).service = {
    processPayment: mock(() => Promise.resolve(mockResult)),
    getTransactionById: mock(() => Promise.resolve({ _id: 'tid', customerId: 'c1', orderId: 'o1', amount: 100, status: TransactionStatus.COMPLETED })),
    getAllTransactions: mock(() => Promise.resolve([{ _id: 'tid', status: TransactionStatus.COMPLETED }])),
    ...overrides,
  };
  return ctrl;
}

describe('PaymentController', () => {
  test('processPayment returns 200 with payment result', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = { customerId: 'cust_1', orderId: 'ord_1', amount: 100, productId: 'prod_1' };

    await ctrl.processPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      transactionId: 'txn_1',
      orderId: 'ord_1',
      customerId: 'cust_1',
    });
  });

  test('processPayment returns 400 when required fields missing', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = {};

    await ctrl.processPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('getTransactionById returns 200', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.params = { id: 'tid' };

    await ctrl.getTransactionById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('getTransactionById returns 404 when not found', async () => {
    const ctrl = createController({ getTransactionById: mock(() => Promise.reject(new Error('Transaction not found'))) });
    const { req, res } = createReqRes();
    req.params = { id: 'nonexistent' };

    await ctrl.getTransactionById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('getAllTransactions returns 200', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();

    await ctrl.getAllTransactions(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
