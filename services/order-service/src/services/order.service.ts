import { v4 as uuidv4 } from 'uuid';
import { OrderRepository } from '../repositories/order.repository';
import { IOrder } from '../models/order.model';
import { CustomerService } from './customer.service';
import { ProductService } from './product.service';
import { PaymentService } from './payment.service';
import logger from '../../../../shared/utils/logger';

export class OrderService {
  private repository: OrderRepository;
  private customerService: CustomerService;
  private productService: ProductService;
  private paymentService: PaymentService;

  constructor() {
    this.repository = new OrderRepository();
    this.customerService = new CustomerService();
    this.productService = new ProductService();
    this.paymentService = new PaymentService();
  }

  async createOrder(data: {
    customerId: string;
    productId: string;
    amount: number;
    quantity?: number;
    idempotencyKey?: string;
  }): Promise<{ order: IOrder; paymentStatus: string }> {
    const key = data.idempotencyKey || uuidv4();
    const quantity = data.quantity || 1;

    const existingOrder = await this.repository.findByIdempotencyKey(key);
    if (existingOrder) {
      logger.info(`Idempotent order request: ${key}`);
      return { order: existingOrder, paymentStatus: existingOrder.orderStatus };
    }

    await this.customerService.validateCustomer(data.customerId);

    const product = await this.productService.validateProduct(data.productId);
    if (product.stock < quantity) {
      throw new Error('Insufficient stock');
    }

    let order: IOrder;
    try {
      order = await this.repository.create({
        idempotencyKey: key,
        customerId: data.customerId,
        productId: data.productId,
        amount: data.amount,
        orderStatus: 'pending'
      });
    } catch (error: any) {
      if (error.code === 11000) {
        const existing = await this.repository.findByIdempotencyKey(key);
        if (existing) {
          return { order: existing, paymentStatus: existing.orderStatus };
        }
      }
      throw error;
    }

    logger.info(`Order created: ${order._id}`);

    let paymentStatus = 'pending';
    try {
      await this.productService.reserveStock(data.productId, quantity);
      logger.info(`Stock reserved: ${quantity} units for product ${data.productId}`);
    } catch (error: any) {
      await this.repository.updateStatus(order._id.toString(), 'failed');
      throw new Error(`Stock reservation failed: ${error.message}`);
    }

    try {
      const paymentResult = await this.paymentService.processPayment({
        idempotencyKey: key,
        customerId: data.customerId,
        orderId: order._id.toString(),
        amount: data.amount,
        productId: data.productId
      });

      paymentStatus = paymentResult.status;

      if (paymentStatus === 'success') {
        await this.repository.updateStatus(order._id.toString(), 'paid');
        logger.info(`Order ${order._id} paid successfully`);
      } else {
        await this.productService.releaseStock(data.productId, quantity);
        await this.repository.updateStatus(order._id.toString(), 'failed');
        logger.warn(`Order ${order._id} payment failed, stock released`);
      }
    } catch (error: any) {
      await this.productService.releaseStock(data.productId, quantity);
      await this.repository.updateStatus(order._id.toString(), 'failed');
      paymentStatus = 'failed';
      logger.error(`Payment error: ${error.message}`);
    }

    const updatedOrder = await this.repository.findById(order._id.toString()) as IOrder;
    return { order: updatedOrder, paymentStatus };
  }

  async getOrderById(id: string): Promise<IOrder> {
    const order = await this.repository.findById(id);
    if (!order) {
      throw new Error('Order not found');
    }
    return order;
  }

  async getAllOrders(): Promise<IOrder[]> {
    return await this.repository.findAll();
  }

  async updateOrderStatus(id: string, status: string): Promise<IOrder> {
    const validStatuses = ['pending', 'paid', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const order = await this.repository.findById(id);
    if (!order) {
      throw new Error('Order not found');
    }

    const allowedTransitions: Record<string, string[]> = {
      pending: ['paid', 'failed', 'cancelled'],
      paid: ['cancelled'],
      failed: [],
      cancelled: []
    };

    const allowed = allowedTransitions[order.orderStatus];
    if (!allowed || !allowed.includes(status)) {
      throw new Error(
        `Cannot transition order from '${order.orderStatus}' to '${status}'`
      );
    }

    const updated = await this.repository.updateStatus(id, status);
    if (!updated) {
      throw new Error('Order not found');
    }

    logger.info(`Order ${id} status updated to ${status}`);
    return updated;
  }
}
