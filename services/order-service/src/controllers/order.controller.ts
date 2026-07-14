import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import logger from '../../../../shared/utils/logger';

interface Params {
  id: string
}

export class OrderController {
  private service: OrderService;

  constructor() {
    this.service = new OrderService();
  }

  createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, productId, amount, quantity, idempotencyKey } = req.body;

      if (!customerId || !productId || !amount) {
        res.status(400).json({
          error: 'Missing required fields: customerId, productId, amount'
        });
        return;
      }

      const result = await this.service.createOrder({
        customerId,
        productId,
        amount,
        quantity: quantity || 1,
        idempotencyKey
      });

      const response = {
        customerId: result.order.customerId,
        orderId: result.order._id,
        productId: result.order.productId,
        orderStatus: result.order.orderStatus
      };

      res.status(201).json(response);
    } catch (error: any) {
      logger.error('Error in createOrder:', error);
      if (error.message.includes('Stock reservation failed')) {
        res.status(409).json({ error: error.message });
      } else if (error.message.includes('Product out of stock')) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

  getOrderById = async (req: Request<Params>, res: Response): Promise<void> => {
    try {
      const order = await this.service.getOrderById(req.params.id);
      res.status(200).json(order);
    } catch (error: any) {
      if (error.message === 'Order not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  getAllOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const orders = await this.service.getAllOrders();
      res.status(200).json(orders);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // ✅ Add this method
  updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId, status } = req.body;
      
      if (!orderId || !status) {
        res.status(400).json({ 
          error: 'Missing required fields: orderId, status' 
        });
        return;
      }

      const validStatuses = ['pending', 'paid', 'failed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
        return;
      }

      const order = await this.service.updateOrderStatus(orderId, status);
      
      res.status(200).json({
        message: 'Order status updated successfully',
        order: order
      });
    } catch (error: any) {
      logger.error('❌ Error in updateOrderStatus:', error);
      if (error.message === 'Order not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}