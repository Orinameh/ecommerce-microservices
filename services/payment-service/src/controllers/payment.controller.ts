import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import logger from '../../../../shared/utils/logger';

interface Params {
    id: string
}

export class PaymentController {
  private service: PaymentService;

  constructor() {
    this.service = new PaymentService();
  }

  processPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, orderId, amount, productId, idempotencyKey } = req.body;

      if (!customerId || !orderId || !amount) {
        res.status(400).json({
          error: 'Missing required fields: customerId, orderId, amount'
        });
        return;
      }

      const result = await this.service.processPayment({
        customerId,
        orderId,
        amount,
        productId,
        idempotencyKey
      });

      // Return payment status (matches flowchart)
      res.status(200).json({
        status: result.status,
        transactionId: result.transactionId,
        orderId,
        customerId
      });
    } catch (error: any) {
      logger.error('❌ Error in processPayment:', error);
      res.status(500).json({ error: error.message });
    }
  };

  getTransactionById = async (req: Request<Params>, res: Response): Promise<void> => {
    try {
      const transaction = await this.service.getTransactionById(req.params.id);
      res.status(200).json(transaction);
    } catch (error: any) {
      if (error.message === 'Transaction not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  getAllTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const transactions = await this.service.getAllTransactions();
      res.status(200).json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}