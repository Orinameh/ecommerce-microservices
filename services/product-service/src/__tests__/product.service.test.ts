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

const { ProductService } = await import('../services/product.service');

const mockProduct = {
  _id: '507f1f77bcf86cd799439011',
  name: 'MacBook Pro 16"',
  description: 'M3 Pro chip',
  price: 2499.99,
  stock: 10,
};

function createMockRepository() {
  return {
    findById: mock(() => Promise.resolve(mockProduct)),
    findAll: mock(() => Promise.resolve([mockProduct])),
    findByStock: mock(() => Promise.resolve([mockProduct])),
    create: mock(() => Promise.resolve(mockProduct)),
    update: mock(() => Promise.resolve(mockProduct)),
    updateStock: mock(() => Promise.resolve({ ...mockProduct, stock: 8 })),
    reserveStockAtomic: mock(() => Promise.resolve({ ...mockProduct, stock: 8 })),
    releaseStockAtomic: mock(() => Promise.resolve({ ...mockProduct, stock: 12 })),
    delete: mock(() => Promise.resolve(true)),
    seedDefaultProducts: mock(() => Promise.resolve()),
  };
}

describe('ProductService', () => {
  test('getProductById returns product when found', async () => {
    const repo = createMockRepository();
    const service = new ProductService();
    (service as any).repository = repo;

    const result = await service.getProductById('507f1f77bcf86cd799439011');

    expect(result).toEqual(mockProduct);
    expect(repo.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  test('getProductById throws when not found', async () => {
    const repo = createMockRepository();
    repo.findById = mock(() => Promise.resolve(null));
    const service = new ProductService();
    (service as any).repository = repo;

    expect(service.getProductById('nonexistent')).rejects.toThrow('Product not found');
  });

  test('getAllProducts returns all products', async () => {
    const repo = createMockRepository();
    const service = new ProductService();
    (service as any).repository = repo;

    const result = await service.getAllProducts();
    expect(result).toEqual([mockProduct]);
  });

  test('reserveStock decrements stock atomically', async () => {
    const repo = createMockRepository();
    const service = new ProductService();
    (service as any).repository = repo;

    const result = await service.reserveStock('507f1f77bcf86cd799439011', 2);

    expect(result.stock).toBe(8);
    expect(repo.reserveStockAtomic).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 2);
  });

  test('reserveStock throws on insufficient stock', async () => {
    const repo = createMockRepository();
    repo.reserveStockAtomic = mock(() => Promise.resolve(null));
    const service = new ProductService();
    (service as any).repository = repo;

    expect(service.reserveStock('507f1f77bcf86cd799439011', 12)).rejects.toThrow('Insufficient stock');
  });

  test('reserveStock throws when product not found', async () => {
    const repo = createMockRepository();
    repo.reserveStockAtomic = mock(() => Promise.resolve(null));
    repo.findById = mock(() => Promise.resolve(null));
    const service = new ProductService();
    (service as any).repository = repo;

    expect(service.reserveStock('nonexistent', 1)).rejects.toThrow('Product not found');
  });

  test('releaseStock increments stock', async () => {
    const repo = createMockRepository();
    const service = new ProductService();
    (service as any).repository = repo;

    const result = await service.releaseStock('507f1f77bcf86cd799439011', 2);

    expect(result.stock).toBe(12);
    expect(repo.releaseStockAtomic).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 2);
  });

  test('getAvailableStock returns stock count', async () => {
    const repo = createMockRepository();
    const service = new ProductService();
    (service as any).repository = repo;

    const result = await service.getAvailableStock('507f1f77bcf86cd799439011');

    expect(result).toBe(10);
  });
});
