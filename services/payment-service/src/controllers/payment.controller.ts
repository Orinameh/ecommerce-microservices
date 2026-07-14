import { Request, Response } from 'express';
import { catchAsync } from '../../../../shared/utils/middleware';
import { ApiResponse } from '../../../../shared/utils/response';
import { PaymentService } from '../services/payment.service';

interface Params {
  [key: string]: string;
  id: string
}

export class PaymentController {
  private service: PaymentService;

  constructor() {
    this.service = new PaymentService();
  }

  processPayment = catchAsync(async (req: Request, res: Response) => {
    const { customerId, orderId, amount, productId, idempotencyKey } = req.body;

    if (!customerId || !orderId || !amount) {
      ApiResponse.badRequest(res, 'Missing required fields: customerId, orderId, amount');
      return;
    }

    const result = await this.service.processPayment({
      customerId,
      orderId,
      amount,
      productId,
      idempotencyKey
    });

    ApiResponse.success(res, {
      status: result.status,
      transactionId: result.transactionId,
      orderId,
      customerId
    });
  });

  getTransactionById = catchAsync(async (req: Request<Params>, res: Response) => {
    const transaction = await this.service.getTransactionById(req.params.id);
    ApiResponse.success(res, transaction);
  });

  getAllTransactions = catchAsync(async (req: Request, res: Response) => {
    const transactions = await this.service.getAllTransactions();
    ApiResponse.success(res, transactions);
  });
}
