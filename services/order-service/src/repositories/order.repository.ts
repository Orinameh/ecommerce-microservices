import logger from "../../../../shared/utils/logger";
import { Order, IOrder } from "../models/order.model";

export class OrderRepository {
  async findById(id: string): Promise<IOrder | null> {
    try {
      return await Order.findById(id);
    } catch (error) {
      logger.error("Error finding order by ID:", error);
      throw error;
    }
  }

  async findByIdempotencyKey(key: string): Promise<IOrder | null> {
    try {
      return await Order.findOne({ idempotencyKey: key });
    } catch (error) {
      logger.error("Error finding idempotent order by key:", error);
      throw error;
    }
  }

  async findAll(): Promise<IOrder[]> {
    try {
      return await Order.find({}).sort({ createdAt: -1 });
    } catch (error) {
      logger.error("Error finding all orders:", error);
      throw error;
    }
  }

  async create(data: Partial<IOrder>): Promise<IOrder> {
    try {
      const order = new Order(data);
      return await order.save();
    } catch (error) {
      logger.error("Error creating order:", error);
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<IOrder | null> {
    try {
      return await Order.findByIdAndUpdate(
        id,
        { orderStatus: status },
        { new: true },
      );
    } catch (error) {
      logger.error("Error updating order", error);
      throw error;
    }
  }
}
