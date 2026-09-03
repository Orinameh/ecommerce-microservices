import { OrderRepository } from '../repositories/order.repository';
import { IOrder } from '../models/order.model';
import { CustomerService } from './customer.service';
import { ProductService } from './product.service';
import { PaymentService } from './payment.service';
import { OrderStatus, PaymentStatus } from '../../../../shared/utils/status';
import { AppError, MONGO_DUPLICATE_KEY_ERROR } from '../../../../shared/utils/errors';
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
    idempotencyKey: string;
  }): Promise<{ order: IOrder; paymentStatus: PaymentStatus }> {
    if (!data.idempotencyKey || typeof data.idempotencyKey !== 'string') {
      throw new AppError('Idempotency key is required', 400);
    }
    const key = data.idempotencyKey;
    const quantity = data.quantity || 1;

    const existingOrder = await this.repository.findByIdempotencyKey(key);
    if (existingOrder) {
      logger.info(`Idempotent order request: ${key}`);
      const paymentStatus = existingOrder.orderStatus === OrderStatus.PAID
        ? PaymentStatus.SUCCESS
        : PaymentStatus.FAILED;
      return { order: existingOrder, paymentStatus };
    }

    await this.customerService.validateCustomer(data.customerId);

    const product = await this.productService.validateProduct(data.productId);
    const expectedAmount = product.price * quantity;
    if (Math.abs(data.amount - expectedAmount) > 0.01) {
      throw new AppError(`Amount mismatch: expected ${expectedAmount.toFixed(2)} for ${quantity}x ${product.name} at ${product.price}`, 400);
    }

    let order: IOrder;
    try {
      order = await this.repository.create({
        idempotencyKey: key,
        customerId: data.customerId,
        productId: data.productId,
        amount: data.amount,
        orderStatus: OrderStatus.PENDING
      });
    } catch (error: any) {
      if (error.code === MONGO_DUPLICATE_KEY_ERROR) {
        const existing = await this.repository.findByIdempotencyKey(key);
        if (existing) {
          const paymentStatus = existing.orderStatus === OrderStatus.PAID
            ? PaymentStatus.SUCCESS
            : PaymentStatus.FAILED;
          return { order: existing, paymentStatus };
        }
      }
      throw error;
    }

    logger.info(`Order created: ${order._id}`);

    try {
      await this.productService.reserveStock(data.productId, quantity, key);
      logger.info(`Stock reserved: ${quantity} units for product ${data.productId}`);
    } catch (error: any) {
      logger.warn(`Stock reservation failed for order ${order._id}, compensating: ${error.message}`);
      try {
        await this.repository.updateStatus(order._id.toString(), OrderStatus.FAILED);
      } catch (e) {
        logger.error(`Failed to mark order ${order._id} as FAILED after reserve failure`, e);
      }
      throw error;
    }

    // Fire-and-forget payment but with compensation and unhandled rejection guard
    void this.processPaymentInBackground(key, data, order._id.toString(), quantity).catch(err =>
      logger.error(`Unhandled background payment error for order ${order._id}: ${err?.message}`, err)
    );

    return { order, paymentStatus: PaymentStatus.PENDING };
  }

  async getOrderById(id: string): Promise<IOrder> {
    const order = await this.repository.findById(id);
    if (!order) {
      throw new AppError('Order not found', 404);
    }
    return order;
  }

  async getAllOrders(): Promise<IOrder[]> {
    return await this.repository.findAll();
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<IOrder> {
    const validStatuses = [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.FAILED, OrderStatus.CANCELLED];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const order = await this.repository.findById(id);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Idempotent: if already at desired status, return without error
    if (order.orderStatus === status) {
      logger.info(`Order ${id} already at status ${status}, idempotent return`);
      return order;
    }

    const allowedTransitions: Record<string, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.FAILED, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.CANCELLED],
      [OrderStatus.FAILED]: [],
      [OrderStatus.CANCELLED]: []
    };

    const allowed = allowedTransitions[order.orderStatus];
    if (!allowed || !allowed.includes(status)) {
      throw new AppError(
        `Cannot transition order from '${order.orderStatus}' to '${status}'`, 400
      );
    }

    const updated = await this.repository.updateStatus(id, status);
    if (!updated) {
      throw new AppError('Order not found', 404);
    }

    logger.info(`Order ${id} status updated to ${status}`);
    return updated;
  }

  private async processPaymentInBackground(key: string, data: {
    customerId: string;
    productId: string;
    amount: number;
    quantity?: number;
  }, orderId: string, quantity: number): Promise<void> {
    try {
      const paymentResult = await this.paymentService.processPayment({
        idempotencyKey: key,
        customerId: data.customerId,
        orderId,
        amount: data.amount,
        productId: data.productId
      });

      if (paymentResult.status === PaymentStatus.SUCCESS) {
        logger.info(`Order ${orderId} payment submitted, worker will confirm`);
      } else {
        await this.compensateOrder(orderId, data.productId, quantity, 'payment returned FAILED');
      }
    } catch (error: any) {
      logger.error(`Payment processing error for order ${orderId}: ${error.message}`);
      await this.compensateOrder(orderId, data.productId, quantity, `payment error: ${error.message}`);
    }
  }

  private async compensateOrder(orderId: string, productId: string, quantity: number, reason: string): Promise<void> {
    try {
      await this.productService.releaseStock(productId, quantity, orderId);
      logger.info(`Stock released for order ${orderId} (${reason})`);
    } catch (e: any) {
      logger.error(`Failed to release stock for order ${orderId}: ${e.message}`);
    }
    try {
      const current = await this.repository.findById(orderId);
      if (current && current.orderStatus === OrderStatus.PENDING) {
        await this.repository.updateStatus(orderId, OrderStatus.FAILED);
        logger.warn(`Order ${orderId} marked FAILED (${reason})`);
      }
    } catch (e: any) {
      logger.error(`Failed to mark order ${orderId} as FAILED: ${e.message}`);
    }
  }
}
