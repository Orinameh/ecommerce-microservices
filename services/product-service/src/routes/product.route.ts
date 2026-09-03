import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { validateStockOperation } from '../middleware';

const router = Router();
const controller = new ProductController();

router.get('/products', controller.getAllProducts);
router.get('/products/:id', controller.getProductById);
router.post('/products', controller.createProduct);
router.put('/products/:id', controller.updateProduct);
router.delete('/products/:id', controller.deleteProduct);

// Stock management endpoints - validated to prevent negative quantity bypass
router.post('/products/reserve', validateStockOperation, controller.reserveStock);
router.post('/products/release', validateStockOperation, controller.releaseStock);

export default router;