import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';

const router = Router();
const controller = new OrderController();

router.post('/orders', controller.createOrder);
router.get('/orders', controller.getAllOrders);
router.get('/orders/:id', controller.getOrderById);
router.put('/orders/status', controller.updateOrderStatus);

export default router;
