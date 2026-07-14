import mongoose from 'mongoose';
import { IProduct, Product } from '../models/product.model';
import logger from '../../../../shared/utils/logger';

export class ProductRepository {
  async findById(id: string): Promise<IProduct | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await Product.findById(id);
    } catch (error) {
      logger.error('Error finding product by ID:', error);
      throw error;
    }
  }

  async findAll(): Promise<IProduct[]> {
    try {
      return await Product.find({});
    } catch (error) {
      logger.error('Error finding all products:', error);
      throw error;
    }
  }

  async findByStock(): Promise<IProduct[]> {
    try {
      return await Product.find({ stock: { $gt: 0 } });
    } catch (error) {
      logger.error('Error finding products by stock:', error);
      throw error;
    }
  }

  async create(data: Partial<IProduct>): Promise<IProduct> {
    try {
      const product = new Product(data);
      return await product.save();
    } catch (error) {
      logger.error('Error creating product:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<IProduct>): Promise<IProduct | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await Product.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
      logger.error('Error updating product:', error);
      throw error;
    }
  }

  async updateStock(id: string, quantity: number): Promise<IProduct | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await Product.findByIdAndUpdate(
        id,
        { $inc: { stock: -quantity } },
        { new: true }
      );
    } catch (error) {
      logger.error('Error updating product stock:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      const result = await Product.findByIdAndDelete(id);
      return result !== null;
    } catch (error) {
      logger.error('Error deleting product:', error);
      throw error;
    }
  }

  async seedDefaultProducts(): Promise<void> {
    try {
      const count = await Product.countDocuments();
      if (count === 0) {
        const products = [
          {
            name: 'MacBook Pro 16"',
            description: 'M3 Pro chip, 18GB RAM, 512GB SSD, Space Black',
            price: 2499.99,
            stock: 30
          },
          {
            name: 'iPhone 15 Pro Max',
            description: '6.7" display, 256GB, Titanium, Natural',
            price: 1199.99,
            stock: 50
          },
          {
            name: 'Sony WH-1000XM5',
            description: 'Wireless noise-cancelling headphones, 30hr battery',
            price: 399.99,
            stock: 75
          },
          {
            name: 'Samsung 49" Odyssey G9',
            description: 'Curved gaming monitor, 240Hz, 4K, Quantum HDR',
            price: 1499.99,
            stock: 20
          }
        ];

        await Product.insertMany(products);
        logger.info('Default products seeded');
      }
    } catch (error) {
      logger.error('Error seeding default products:', error);
    }
  }
}
