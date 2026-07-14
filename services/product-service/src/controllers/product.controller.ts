import { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import logger from "../../../../shared/utils/logger";

interface RouteParams {
  id: string;
}

export class ProductController {
  private service: ProductService;

  constructor() {
    this.service = new ProductService();
  }

  getProductById = async (
    req: Request<RouteParams>,
    res: Response,
  ): Promise<void> => {
    try {
      const product = await this.service.getProductById(req.params.id);
      res.status(200).json(product);
    } catch (error: any) {
      logger.error("Error in getProductById:", error);
      if (error.message === "Product not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };

  getAllProducts = async (req: Request, res: Response): Promise<void> => {
    try {
      const products = await this.service.getAllProducts();
      res.status(200).json(products);
    } catch (error: any) {
      logger.error("Error in getAllProducts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  createProduct = async (
    req: Request<RouteParams>,
    res: Response,
  ): Promise<void> => {
    try {
      const product = await this.service.createProduct(req.body);
      res.status(201).json(product);
    } catch (error: any) {
      logger.error("Error in createProduct:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  updateProduct = async (
    req: Request<RouteParams>,
    res: Response,
  ): Promise<void> => {
    try {
      const product = await this.service.updateProduct(req.params.id, req.body);
      res.status(200).json(product);
    } catch (error: any) {
      logger.error("Error in updateProduct:", error);
      if (error.message === "Product not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };

  deleteProduct = async (
    req: Request<RouteParams>,
    res: Response,
  ): Promise<void> => {
    try {
      await this.service.deleteProduct(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      logger.error("Error in deleteProduct:", error);
      if (error.message === "Product not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };

  getAvailableStock = async (
    req: Request<RouteParams>,
    res: Response,
  ): Promise<void> => {
    try {
      const stock = await this.service.getAvailableStock(req.params.id);
      res.status(200).json({ productId: req.params.id, availableStock: stock });
    } catch (error: any) {
      logger.error("Error in getAvailableStock:", error);
      if (error.message === "Product not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };

  reserveStock = async (req: Request, res: Response): Promise<void> => {
    try {
      const { productId, quantity } = req.body;
      if (!productId || !quantity) {
        res.status(400).json({ error: 'Missing productId or quantity' });
        return;
      }
      const product = await this.service.reserveStock(productId, quantity);
      res.status(200).json({ success: true, product });
    } catch (error: any) {
      logger.error('Error in reserveStock:', error);
      if (error.message === 'Insufficient stock') {
        res.status(409).json({ error: error.message });
      } else if (error.message === 'Product not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  releaseStock = async (req: Request, res: Response): Promise<void> => {
    try {
      const { productId, quantity } = req.body;
      if (!productId || !quantity) {
        res.status(400).json({ error: 'Missing productId or quantity' });
        return;
      }
      const product = await this.service.releaseStock(productId, quantity);
      res.status(200).json({ success: true, product });
    } catch (error: any) {
      logger.error('Error in releaseStock:', error);
      if (error.message === 'Product not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

}
