import { describe, expect, test, mock } from 'bun:test';

mock.module('../../../../shared/utils/logger', () => ({
  default: {
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
  },
}));

const {
  requestIdMiddleware,
  errorHandler,
  notFoundHandler,
  timeoutMiddleware,
} = await import('../middleware/index');

function createReqRes() {
  const req: any = {
    headers: {},
    ip: '127.0.0.1',
    method: 'GET',
    originalUrl: '/test',
    path: '/test',
    get: (h: string) => req.headers[h.toLowerCase()],
  };
  const res: any = {
    status: mock(() => res),
    json: mock(() => res),
    send: mock(() => res),
    setHeader: mock(() => {}),
    setTimeout: mock((_ms: number, _cb: () => void) => {}),
    on: mock(() => res),
    get: mock(() => undefined),
  };
  const next = mock(() => {});
  return { req, res, next };
}

describe('requestIdMiddleware', () => {
  test('generates requestId when X-Request-Id not provided', () => {
    const { req, res, next } = createReqRes();

    requestIdMiddleware(req, res, next);

    expect((req as any).requestId).toBeDefined();
    expect((req as any).requestId).toStartWith('req_');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', (req as any).requestId);
    expect(next).toHaveBeenCalled();
  });

  test('uses X-Request-Id header when provided', () => {
    const { req, res, next } = createReqRes();
    req.headers['x-request-id'] = 'client-provided-id';

    requestIdMiddleware(req, res, next);

    expect((req as any).requestId).toBe('client-provided-id');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'client-provided-id');
  });
});

describe('notFoundHandler', () => {
  test('returns 404 with route info', () => {
    const { req, res } = createReqRes();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Route not found', path: '/test', method: 'GET' })
    );
  });
});

describe('errorHandler', () => {
  test('returns 500 with error message in development', () => {
    const { req, res } = createReqRes();
    const err = new Error('Something broke');

    errorHandler(err, req, res, mock(() => {}));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Something broke', stack: err.stack })
    );
  });

  test('returns generic message in production', () => {
    const origNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const { req, res } = createReqRes();
    const err = new Error('Something broke');

    errorHandler(err, req, res, mock(() => {}));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Internal server error' })
    );
    process.env.NODE_ENV = origNodeEnv;
  });
});

describe('timeoutMiddleware', () => {
  test('sets timeout on response', () => {
    const { req, res, next } = createReqRes();
    const middleware = timeoutMiddleware(5000);

    middleware(req, res, next);

    expect(res.setTimeout).toHaveBeenCalledWith(5000, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });
});
