import { ProductRepository } from '../repositories/product.repository';
import { IProduct } from '../models/product.model';

export class ProductService {
  private repository: ProductRepository;

  constructor() {
    this.repository = new ProductRepository();
  }

  async getProductById(id: string): Promise<IProduct> {
    const product = await this.repository.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  }

  async getAllProducts(): Promise<IProduct[]> {
    return await this.repository.findAll();
  }

  async getAvailableProducts(): Promise<IProduct[]> {
    return await this.repository.findByStock();
  }

  async createProduct(data: Partial<IProduct>): Promise<IProduct> {
    return await this.repository.create(data);
  }

  async updateProduct(id: string, data: Partial<IProduct>): Promise<IProduct> {
    const product = await this.repository.update(id, data);
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new Error('Product not found');
    }
  }

  async seedDefaultProducts(): Promise<void> {
    await this.repository.seedDefaultProducts();
  }

  async reserveStock(productId: string, quantity: number): Promise<IProduct> {
    const product = await this.repository.updateStock(productId, quantity);
    if (!product) {
      throw new Error('Product not found');
    }
    if (product.stock < 0) {
      await this.repository.updateStock(productId, -quantity);
      throw new Error('Insufficient stock');
    }
    return product;
  }

  async releaseStock(productId: string, quantity: number): Promise<IProduct> {
    const product = await this.repository.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    return await this.repository.updateStock(productId, -quantity) as IProduct;
  }

  async getAvailableStock(productId: string): Promise<number> {
    const product = await this.repository.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    return product.stock;
  }
}
