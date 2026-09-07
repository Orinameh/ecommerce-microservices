import client from "prom-client";

// 2026 best practice: collectDefaultMetrics once per process, expose via /metrics for Prometheus
// Call setupMetrics() from service entrypoint before starting server.

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: "nodejs_" });

// Golden signals: latency, traffic, errors, saturation

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code", "service"],
  buckets: [0.05, 0.1, 0.3, 0.5, 0.75, 1, 2, 5],
  registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code", "service"],
  registers: [registry],
});

export const httpRequestsInFlight = new client.Gauge({
  name: "http_requests_in_flight",
  help: "In-flight HTTP requests",
  labelNames: ["service"],
  registers: [registry],
});

// Business / infra custom metrics
export const dbQueryDuration = new client.Histogram({
  name: "db_query_duration_seconds",
  help: "DB query duration",
  labelNames: ["operation", "collection", "service"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [registry],
});

export const rabbitmqPublishTotal = new client.Counter({
  name: "rabbitmq_messages_published_total",
  help: "RabbitMQ messages published",
  labelNames: ["exchange", "routing_key", "service"],
  registers: [registry],
});

export const rabbitmqConsumeTotal = new client.Counter({
  name: "rabbitmq_messages_consumed_total",
  help: "RabbitMQ messages consumed",
  labelNames: ["queue", "service", "status"],
  registers: [registry],
});

// Keep small: avoid high-cardinality labels (no userId, orderId)

export function setupMetrics(serviceName: string) {
  // Expose service label for all metrics
  registry.setDefaultLabels({ service: serviceName });
}

import type { Request, Response, NextFunction } from "express";

/**
 * Express middleware: observe httpRequestDuration + httpRequestsTotal.
 * Place after requestIdMiddleware, before routes.
 * Normalizes route label to avoid cardinality explosion (use req.route?.path or originalUrl sanitized).
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime();
  httpRequestsInFlight.inc({ service: (req as any).serviceName || "unknown" });

  // Capture response finish
  res.on("finish", () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;
    // Use Express route pattern if available, else sanitize: replace ids with :id
    const route = (req.route?.path as string) || req.path.replace(/\/[a-f0-9-]{10,}/gi, "/:id").replace(/\/\d+/g, "/:id");
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
      service: (req as any).serviceName || process.env.SERVICE_NAME || "unknown",
    };
    httpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);
    httpRequestsInFlight.dec({ service: labels.service });
  });

  next();
}
