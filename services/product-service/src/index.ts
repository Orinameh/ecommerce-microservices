import express from "express";
import { Database } from "../../../shared/utils/database";
import { config } from "./config";
import {
  securityMiddleware,
  rateLimiter,
  loggingMiddleware,
  errorHandler,
  notFoundHandler,
} from "./middleware";
import productRoutes from "./routes/product.route";
import { ProductService } from "./services/product.service";
import logger from "../../../shared/utils/logger";

const app = express();

app.use(securityMiddleware);
app.use(rateLimiter);
app.use(loggingMiddleware);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: config.serviceName,
    database: Database.getInstance().isConnectedToDatabase(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", productRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    await Database.getInstance().connect(config.mongodbUri);

    const productService = new ProductService();
    await productService.seedDefaultProducts();

    app.listen(config.port, () => {
      logger.info(`${config.serviceName} running on port ${config.port}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

const gracefulShutdown = async () => {
  logger.info("Shutting down...");
  await Database.getInstance().disconnect();
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
