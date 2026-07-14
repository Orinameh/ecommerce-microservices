import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';

const router = Router();
const controller = new ProductController();

router.get('/products', controller.getAllProducts);
router.get('/products/:id', controller.getProductById);
router.post('/products', controller.createProduct);
router.put('/products/:id', controller.updateProduct);
router.delete('/products/:id', controller.deleteProduct);

// Stock management endpoints
router.post('/products/reserve', controller.reserveStock);
router.post('/products/release', controller.releaseStock);

export default router;