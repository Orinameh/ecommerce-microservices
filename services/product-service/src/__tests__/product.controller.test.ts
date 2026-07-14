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

const { ProductController } = await import('../controllers/product.controller');

const mockProduct = { _id: '507f1f77bcf86cd799439011', name: 'MacBook', price: 2499, stock: 10 };

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
  const ctrl = new ProductController();
  (ctrl as any).service = {
    getProductById: mock(() => Promise.resolve(mockProduct)),
    getAllProducts: mock(() => Promise.resolve([mockProduct])),
    createProduct: mock(() => Promise.resolve(mockProduct)),
    updateProduct: mock(() => Promise.resolve(mockProduct)),
    deleteProduct: mock(() => Promise.resolve()),
    reserveStock: mock(() => Promise.resolve({ ...mockProduct, stock: 8 })),
    releaseStock: mock(() => Promise.resolve({ ...mockProduct, stock: 12 })),
    getAvailableStock: mock(() => Promise.resolve(10)),
    ...overrides,
  };
  return ctrl;
}

describe('ProductController', () => {
  test('getProductById returns 200 with product', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.params = { id: '507f1f77bcf86cd799439011' };

    await ctrl.getProductById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('getProductById returns 404 when not found', async () => {
    const ctrl = createController({ getProductById: mock(() => Promise.reject(new Error('Product not found'))) });
    const { req, res } = createReqRes();
    req.params = { id: 'nonexistent' };

    await ctrl.getProductById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('createProduct returns 201', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = { name: 'New', price: 100, stock: 5 };

    await ctrl.createProduct(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('reserveStock returns 200 with success', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = { productId: '507f1f77bcf86cd799439011', quantity: 2 };

    await ctrl.reserveStock(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, product: { ...mockProduct, stock: 8 } });
  });

  test('reserveStock returns 400 when fields missing', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = {};

    await ctrl.reserveStock(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('reserveStock returns 409 on insufficient stock', async () => {
    const ctrl = createController({ reserveStock: mock(() => Promise.reject(new Error('Insufficient stock'))) });
    const { req, res } = createReqRes();
    req.body = { productId: 'pid', quantity: 99 };

    await ctrl.reserveStock(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('releaseStock returns 200', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = { productId: '507f1f77bcf86cd799439011', quantity: 2 };

    await ctrl.releaseStock(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('releaseStock returns 400 when fields missing', async () => {
    const ctrl = createController();
    const { req, res } = createReqRes();
    req.body = {};

    await ctrl.releaseStock(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
