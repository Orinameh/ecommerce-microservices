import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';

const router = Router();
const controller = new CustomerController();

router.get('/customers', controller.getAllCustomers);
router.get('/customers/:id', controller.getCustomerById);
router.post('/customers', controller.createCustomer);
router.put('/customers/:id', controller.updateCustomer);
router.delete('/customers/:id', controller.deleteCustomer);

export default router;