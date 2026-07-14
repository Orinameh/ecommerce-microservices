# Order Service

Orchestrates the order lifecycle following the Saga pattern. Acts as the central coordinator, calling downstream services synchronously over HTTP and applying compensating actions on failure.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders` | Create order (main entry point) |
| GET | `/api/orders` | List all orders |
| GET | `/api/orders/:id` | Get order by ID |
| PUT | `/api/orders/status` | Update order status (internal) |
| GET | `/health` | Health check |

## Order Flow

1. Check idempotency (by `idempotencyKey`)
2. Validate customer via **customer-service** (`GET /api/customers/:id`)
3. Validate product via **product-service** (`GET /api/products/:id`)
4. Create order in MongoDB (status: `pending`)
5. Reserve stock via **product-service** (`POST /api/products/reserve`)
6. Process payment via **payment-service** (`POST /api/payments/process`)
7. On success: update order to `paid`
8. On failure: release stock, update order to `failed`

## Idempotency

Write operations use idempotency keys. If a duplicate request arrives, the existing result is returned without side effects.

## State Transitions

```
pending → paid | failed | cancelled
paid    → cancelled
failed  → (none)
cancelled → (none)
```

## Environment Variables

| Variable | Default |
|----------|---------|
| `PORT` | `5003` |
| `MONGODB_URI` | `mongodb://admin:password@mongodb:27017/ecommerce?authSource=admin` |
| `CUSTOMER_SERVICE_URL` | `http://customer-service:5001` |
| `PRODUCT_SERVICE_URL` | `http://product-service:5002` |
| `PAYMENT_SERVICE_URL` | `http://payment-service:5004` |
| `RATE_LIMIT_MAX` | `50` |
