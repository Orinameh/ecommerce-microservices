import { Request, Response } from "express";
import { ApiResponse } from "../../../../shared/utils/response";
import { catchAsync } from "../../../../shared/utils/middleware";
import { ProductService } from "../services/product.service";

interface RouteParams {
  id: string;
}

const requestId = (req: Request): string | undefined => (req as any).requestId;

export class ProductController {
  private service: ProductService;

  constructor() {
    this.service = new ProductService();
  }

  getProductById = catchAsync(async (req: Request<RouteParams>, res: Response) => {
    const product = await this.service.getProductById(req.params.id);
    ApiResponse.success(res, product);
  });

  getAllProducts = catchAsync(async (req: Request, res: Response) => {
    const products = await this.service.getAllProducts();
    ApiResponse.success(res, products);
  });

  createProduct = catchAsync(async (req: Request<RouteParams>, res: Response) => {
    const product = await this.service.createProduct(req.body);
    ApiResponse.created(res, product);
  });

  updateProduct = catchAsync(async (req: Request<RouteParams>, res: Response) => {
    const product = await this.service.updateProduct(req.params.id, req.body);
    ApiResponse.success(res, product);
  });

  deleteProduct = catchAsync(async (req: Request<RouteParams>, res: Response) => {
    await this.service.deleteProduct(req.params.id);
    res.status(204).send();
  });

  getAvailableStock = catchAsync(async (req: Request<RouteParams>, res: Response) => {
    const stock = await this.service.getAvailableStock(req.params.id);
    ApiResponse.success(res, { productId: req.params.id, availableStock: stock });
  });

  reserveStock = catchAsync(async (req: Request, res: Response) => {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) {
      ApiResponse.badRequest(res, 'Missing productId or quantity', requestId(req));
      return;
    }
    const product = await this.service.reserveStock(productId, quantity);
    ApiResponse.success(res, { success: true, product });
  });

  releaseStock = catchAsync(async (req: Request, res: Response) => {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) {
      ApiResponse.badRequest(res, 'Missing productId or quantity', requestId(req));
      return;
    }
    const product = await this.service.releaseStock(productId, quantity);
    ApiResponse.success(res, { success: true, product });
  });
}
