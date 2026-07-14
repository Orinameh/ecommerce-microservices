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
  idempotencyMiddleware,
  errorHandler,
  validateOrderRequest,
} = await import('../middleware/index');

function createReqRes() {
  const req: any = {
    headers: {},
    body: {},
    ip: '127.0.0.1',
    method: 'POST',
    originalUrl: '/api/orders',
    path: '/api/orders',
    get: (h: string) => req.headers[h],
  };
  const res: any = {
    status: mock(() => res),
    json: mock(() => res),
    send: mock(() => res),
    setHeader: mock(() => {}),
    on: mock((_event: string, _cb: () => void) => res),
    get: mock(() => undefined),
  };
  const next = mock(() => {});
  return { req, res, next };
}

describe('idempotencyMiddleware', () => {
  test('generates idempotency key when not provided on POST', () => {
    const { req, res, next } = createReqRes();
    req.method = 'POST';
    req.body = {};

    idempotencyMiddleware(req, res, next);

    expect(req.body.idempotencyKey).toBeDefined();
    expect(req.body.idempotencyKey).toStartWith('ik_');
    expect(next).toHaveBeenCalled();
  });

  test('uses provided idempotency key from body', () => {
    const { req, res, next } = createReqRes();
    req.method = 'POST';
    req.body = { idempotencyKey: 'ik_custom' };

    idempotencyMiddleware(req, res, next);

    expect(req.body.idempotencyKey).toBe('ik_custom');
    expect(next).toHaveBeenCalled();
  });

  test('uses provided idempotency key from header', () => {
    const { req, res, next } = createReqRes();
    req.method = 'POST';
    req.body = {};
    req.headers['idempotency-key'] = 'ik_from_header';

    idempotencyMiddleware(req, res, next);

    expect(req.body.idempotencyKey).toBe('ik_from_header');
    expect((req as any).idempotencyKey).toBe('ik_from_header');
    expect(next).toHaveBeenCalled();
  });

  test('skips key generation on non-POST', () => {
    const { req, res, next } = createReqRes();
    req.method = 'GET';

    idempotencyMiddleware(req, res, next);

    expect(req.body.idempotencyKey).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

describe('validateOrderRequest', () => {
  test('passes when all fields valid', () => {
    const { req, res, next } = createReqRes();
    req.body = { customerId: 'c1', productId: 'p1', amount: 100, quantity: 2 };

    validateOrderRequest(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('rejects missing customerId', () => {
    const { req, res, next } = createReqRes();
    req.body = { productId: 'p1', amount: 100 };

    validateOrderRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Missing customerId' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects missing productId', () => {
    const { req, res, next } = createReqRes();
    req.body = { customerId: 'c1', amount: 100 };

    validateOrderRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Missing productId' }));
  });

  test('rejects amount <= 0', () => {
    const { req, res, next } = createReqRes();
    req.body = { customerId: 'c1', productId: 'p1', amount: 0 };

    validateOrderRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Amount must be greater than 0' }));
  });

  test('rejects quantity <= 0', () => {
    const { req, res, next } = createReqRes();
    req.body = { customerId: 'c1', productId: 'p1', amount: 100, quantity: -1 };

    validateOrderRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('allows missing quantity (defaults to 1)', () => {
    const { req, res, next } = createReqRes();
    req.body = { customerId: 'c1', productId: 'p1', amount: 100 };

    validateOrderRequest(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('errorHandler (order-service)', () => {
  test('returns 503 for circuit open errors', () => {
    const { req, res } = createReqRes();
    const err = new Error('circuit open for product-service');

    errorHandler(err, req, res, mock(() => {}));

    expect(res.status).toHaveBeenCalledWith(503);
  });

  test('returns 409 for insufficient stock', () => {
    const { req, res } = createReqRes();
    const err = new Error('Insufficient stock');

    errorHandler(err, req, res, mock(() => {}));

    expect(res.status).toHaveBeenCalledWith(409);
  });
});
