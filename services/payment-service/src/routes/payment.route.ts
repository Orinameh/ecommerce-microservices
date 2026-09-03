import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { idempotencyMiddleware, validatePaymentRequest } from '../middleware';

const router = Router();
const controller = new PaymentController();

router.post('/payments/process', idempotencyMiddleware, validatePaymentRequest, controller.processPayment);
router.get('/payments/transactions', controller.getAllTransactions);
router.get('/payments/transactions/:id', controller.getTransactionById);

export default router;