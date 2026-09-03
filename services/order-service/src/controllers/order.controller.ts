import { Request, Response } from 'express';
import { catchAsync } from '../../../../shared/utils/middleware';
import { ApiResponse } from '../../../../shared/utils/response';
import { OrderService } from '../services/order.service';
import { OrderStatus, PaymentStatus } from '../../../../shared/utils/status';

interface Params {
  [key: string]: string;
  id: string
}

// Use middleware-provided requestId, fall back to header — not duplicated logic, single helper
const getRequestId = (req: Request): string | undefined =>
  (req as any).requestId || (req.headers['x-request-id'] as string) || undefined;

export class OrderController {
  private service: OrderService;

  constructor() {
    this.service = new OrderService();
  }

  createOrder = catchAsync(async (req: Request, res: Response) => {
    // Validation is handled by validateOrderRequest middleware — no duplicate checks here
    const { customerId, productId, amount, quantity, idempotencyKey } = req.body;

    const result = await this.service.createOrder({
      customerId,
      productId,
      amount,
      quantity: quantity || 1,
      idempotencyKey
    });

    ApiResponse.created(res, {
      customerId: result.order.customerId,
      orderId: result.order._id,
      productId: result.order.productId,
      orderStatus: result.order.orderStatus,
      paymentStatus: result.paymentStatus
    });
  });

  getOrderById = catchAsync(async (req: Request<Params>, res: Response) => {
    const order = await this.service.getOrderById(req.params.id);
    const paymentStatus = order.orderStatus === OrderStatus.PAID
      ? PaymentStatus.SUCCESS
      : order.orderStatus === OrderStatus.FAILED
        ? PaymentStatus.FAILED
        : PaymentStatus.PENDING;
    const orderData = (order as any).toJSON ? (order as any).toJSON() : order;
    ApiResponse.success(res, {
      ...orderData,
      paymentStatus
    });
  });

  getAllOrders = catchAsync(async (req: Request, res: Response) => {
    const orders = await this.service.getAllOrders();
    ApiResponse.success(res, orders);
  });

  updateOrderStatus = catchAsync(async (req: Request, res: Response) => {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      ApiResponse.badRequest(res, 'Missing required fields: orderId, status', getRequestId(req));
      return;
    }

    const validStatuses = Object.values(OrderStatus);
    if (!validStatuses.includes(status)) {
      ApiResponse.badRequest(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, getRequestId(req));
      return;
    }

    const order = await this.service.updateOrderStatus(orderId, status);

    ApiResponse.success(res, {
      message: 'Order status updated successfully',
      order: order
    });
  });
}
