import { describe, expect, test, mock } from 'bun:test';

mock.module('../../../../shared/utils/logger', () => ({
  default: {
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
  },
  logger: {
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
  },
}));

const {
  validateStockOperation,
  errorHandler,
} = await import('../middleware/index');

import { MONGO_DUPLICATE_KEY_ERROR } from '../../../../shared/utils/errors';

function createReqRes() {
  const req: any = {
    headers: {},
    body: {},
    ip: '127.0.0.1',
    method: 'POST',
    originalUrl: '/api/products/reserve',
    path: '/api/products/reserve',
    get: () => {},
  };
  const res: any = {
    status: mock(() => res),
    json: mock(() => res),
    send: mock(() => res),
    setHeader: mock(() => {}),
    on: mock(() => res),
    get: mock(() => undefined),
  };
  const next = mock(() => {});
  return { req, res, next };
}

describe('validateStockOperation', () => {
  test('passes when productId and quantity are valid', () => {
    const { req, res, next } = createReqRes();
    req.body = { productId: 'p1', quantity: 5 };

    validateStockOperation(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('rejects missing productId', () => {
    const { req, res, next } = createReqRes();
    req.body = { quantity: 5 };

    validateStockOperation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects missing quantity', () => {
    const { req, res, next } = createReqRes();
    req.body = { productId: 'p1' };

    validateStockOperation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects quantity of 0', () => {
    const { req, res, next } = createReqRes();
    req.body = { productId: 'p1', quantity: 0 };

    validateStockOperation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects negative quantity', () => {
    const { req, res, next } = createReqRes();
    req.body = { productId: 'p1', quantity: -1 };

    validateStockOperation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('errorHandler (product-service)', () => {
  test('returns 409 for duplicate key error', () => {
    const { req, res } = createReqRes();
    const err: any = new Error('Duplicate key');
    err.code = MONGO_DUPLICATE_KEY_ERROR;

    errorHandler(err, req, res, mock(() => {}));

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('returns 400 for Mongoose validation error', () => {
    const { req, res } = createReqRes();
    const err: any = new Error('Validation failed');
    err.name = 'ValidationError';

    errorHandler(err, req, res, mock(() => {}));

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
