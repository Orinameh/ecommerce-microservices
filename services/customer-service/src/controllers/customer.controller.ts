import { Request, Response } from 'express';
import { ApiResponse } from '../../../../shared/utils/response';
import { catchAsync } from '../../../../shared/utils/middleware';
import { CustomerService } from '../services/customer.service';

interface RouteParams {
  id: string;
}

export class CustomerController {
  private service: CustomerService;

  constructor() {
    this.service = new CustomerService();
  }

  getCustomerById = catchAsync(async (req: Request<RouteParams>, res: Response) => {
    const customer = await this.service.getCustomerById(req.params.id);
    ApiResponse.success(res, customer);
  });

  getAllCustomers = catchAsync(async (_req: Request<RouteParams>, res: Response) => {
    const customers = await this.service.getAllCustomers();
    ApiResponse.success(res, customers);
  });

  createCustomer = catchAsync(async (req: Request<RouteParams>, res: Response) => {
    const customer = await this.service.createCustomer(req.body);
    ApiResponse.created(res, customer);
  });

  updateCustomer = catchAsync(async (req: Request<RouteParams>, res: Response) => {
    const customer = await this.service.updateCustomer(req.params.id, req.body);
    ApiResponse.success(res, customer);
  });

  deleteCustomer = catchAsync(async (req: Request<RouteParams>, res: Response) => {
    await this.service.deleteCustomer(req.params.id);
    res.status(204).send();
  });
}
