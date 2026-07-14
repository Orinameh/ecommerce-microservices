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
const { CustomerController } = await import('../controllers/customer.controller');

const mockCustomer = { _id: '507f1f77bcf86cd799439011', name: 'John', email: 'john@example.com' };

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
  const ctrl = new CustomerController();
  (ctrl as any).service = {
    getCustomerById: mock(() => Promise.resolve(mockCustomer)),
    getAllCustomers: mock(() => Promise.resolve([mockCustomer])),
    createCustomer: mock(() => Promise.resolve(mockCustomer)),
    updateCustomer: mock(() => Promise.resolve(mockCustomer)),
    deleteCustomer: mock(() => Promise.resolve()),
    ...overrides,
  };
  return ctrl;
}

describe('CustomerController', () => {
  test('getCustomerById returns 200 with customer', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.params = { id: '507f1f77bcf86cd799439011' };

    await ctrl.getCustomerById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockCustomer);
  });

  test('getCustomerById returns 404 when not found', async () => {
    const ctrl = createController({ getCustomerById: mock(() => Promise.reject(new AppError('Customer not found', 404))) });
    const { req, res, next } = createReqRes();
    req.params = { id: 'nonexistent' };

    await ctrl.getCustomerById(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Customer not found', statusCode: 404 }));
  });

  test('getAllCustomers returns 200 with list', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();

    await ctrl.getAllCustomers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('createCustomer returns 201 on success', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = { name: 'John', email: 'john@example.com' };

    await ctrl.createCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('createCustomer returns 409 on duplicate email', async () => {
    const ctrl = createController({ createCustomer: mock(() => Promise.reject(new AppError('Customer with this email already exists', 409))) });
    const { req, res, next } = createReqRes();
    req.body = { name: 'John', email: 'existing@example.com' };

    await ctrl.createCustomer(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Customer with this email already exists', statusCode: 409 }));
  });

  test('updateCustomer returns 200 on success', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.params = { id: '507f1f77bcf86cd799439011' };
    req.body = { name: 'Jane' };

    await ctrl.updateCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('deleteCustomer returns 204 on success', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.params = { id: '507f1f77bcf86cd799439011' };

    await ctrl.deleteCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  test('deleteCustomer returns 404 when not found', async () => {
    const ctrl = createController({ deleteCustomer: mock(() => Promise.reject(new AppError('Customer not found', 404))) });
    const { req, res, next } = createReqRes();
    req.params = { id: 'nonexistent' };

    await ctrl.deleteCustomer(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Customer not found', statusCode: 404 }));
  });
});
