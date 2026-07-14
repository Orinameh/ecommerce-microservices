import { Request, Response } from 'express';
import { CustomerService } from '../services/customer.service';
import logger from '../../../../shared/utils/logger';

interface RouteParams {
  id: string;
}
export class CustomerController {
  private service: CustomerService;

  constructor() {
    this.service = new CustomerService();
  }

  getCustomerById = async (req: Request<RouteParams>, res: Response): Promise<void> => {
    try {
      const customer = await this.service.getCustomerById(req.params.id);
      res.status(200).json(customer);
    } catch (error: any) {
      logger.error('Error in getCustomerById:', error);
      if (error.message === 'Customer not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  getAllCustomers = async (req: Request<RouteParams>, res: Response): Promise<void> => {
    try {
      const customers = await this.service.getAllCustomers();
      res.status(200).json(customers);
    } catch (error: any) {
      logger.error('Error in getAllCustomers:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  createCustomer = async (req: Request<RouteParams>, res: Response): Promise<void> => {
    try {
      const customer = await this.service.createCustomer(req.body);
      res.status(201).json(customer);
    } catch (error: any) {
      logger.error('Error in createCustomer:', error);
      if (error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  updateCustomer = async (req: Request<RouteParams>, res: Response): Promise<void> => {
    try {
      const customer = await this.service.updateCustomer(req.params.id, req.body);
      res.status(200).json(customer);
    } catch (error: any) {
      logger.error('Error in updateCustomer:', error);
      if (error.message === 'Customer not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  deleteCustomer = async (req: Request<RouteParams>, res: Response): Promise<void> => {
    try {
      await this.service.deleteCustomer(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      logger.error('Error in deleteCustomer:', error);
      if (error.message === 'Customer not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}