# E-Commerce Microservices

A microservices-based e-commerce platform with RESTful synchronous communication and RabbitMQ-based asynchronous messaging.

## Architecture

```
                          ACTOR
                            │
                            ▼
                   ┌──────────────────┐
                   │  Is order valid?  │
                   └────────┬─────────┘
                            │
                     ┌──────┴──────┐
                     │             │
                   Yes            No
                     │             │
                     ▼             ▼
             ┌────────────┐ ┌────────────┐
             │Create order│ │  Return    │
             └─────┬──────┘ │ validation │
                   │        │   error    │
                   ▼        └─────┬──────┘
          ┌────────────────┐      │
          │Initiate payment│      │
          └───────┬────────┘      │
                  │               │
                  ▼               │
        ┌──────────────────┐      │
        │ Publish to queue  │      │
        └───────┬──────────┘      │
                │                 │
                ▼                 │
       ┌──────────────────┐      │
       │Return order +    │      │
       │ payment status   │      │
       └──────────────────┘      │
                │                 │
                ▼                 │
          ┌──────────┐            │
          │  ACTOR   │◄───────────┘
          └──────────┘


        ┌────────────────────────┐  ┌──────────────────────┐
        │Listen for transactions │─►│ Save transaction      │
        │    (async worker)      │  │    details            │
        └────────────────────────┘  └──────────────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| **customer-service** | 5001 | Manages customer data (CRUD) |
| **product-service** | 5002 | Manages product inventory with stock operations |
| **order-service** | 5003 | Orchestrates order creation (Saga pattern) |
| **payment-service** | 5004 | Processes payments and publishes events |
| **transaction-worker** | - | Async consumer that persists transaction history |

## Tech Stack

- **Runtime**: Node.js 26 (production) / Bun 1.3 (build & dev)
- **Framework**: Express 5
- **Database**: MongoDB 7.0 with Mongoose 9
- **Message Broker**: RabbitMQ 4.0 with amqplib
- **HTTP Client**: Axios with circuit breaker + retry
- **Testing**: Bun test runner

## Order Flow

1. **Customer** sends `POST /api/orders` to order-service with `customerId`, `productId`, `amount`
2. **Order service** validates customer via customer-service (`GET /api/customers/:id`)
3. **Order service** validates product via product-service (`GET /api/products/:id`)
4. **Order service** reserves stock via product-service (`POST /api/products/reserve`)
5. **Order service** sends payment request to payment-service with `productId`
6. **Payment service** creates transaction (status: `completed`), publishes to RabbitMQ queue
7. **Transaction worker** consumes the message, persists to transaction history
8. **Order service** returns response with `customerId`, `orderId`, `productId`, `orderStatus`, `paymentStatus`

> **Note:** In this implementation, the simulated payment always succeeds, so the
> order status goes directly to `paid`. In production with a real payment gateway,
> the order would start as `pending` and update after payment confirmation.

## Running Locally

```bash
docker compose up --build
```

This starts 7 containers: MongoDB, RabbitMQ, 4 services, and the transaction worker.

## Seed Data

On first startup, each service seeds demo data:

- **Customer**: John Doe (john.doe@example.com)
- **Products**: MacBook Pro, iPhone 15 Pro Max, Sony WH-1000XM5, Samsung Odyssey G9

## Testing

```bash
# Run all service tests in one go
cd services && for d in */; do (cd "$d" && bun test); done

# Run tests for a single service
cd services/<service-name> && bun test

# Build for production
cd services/<service-name> && bun build src/index.ts --outdir ./dist --target node
```

## End-to-End Validation

After starting the stack with `docker compose up --build`, run the validation script to verify the full order flow:

```bash
bash test-flow.sh
```

This script validates each step of the specification:

| Step | What it tests | Spec Requirement |
|------|---------------|------------------|
| 1 | Create order via REST | *"request sent to the order service using REST"* |
| 2 | Order persisted in DB | *"order saved in the database"* |
| 3 | Transaction persisted (worker) | *"worker saves queued data in the database transaction history"* |
| 4 | Idempotency — same key, same order | Prevents duplicate orders |
| 5 | Missing fields → 400 | Input validation |
| 6 | Invalid customer → 404 | Error handling |
| 7 | All not-found endpoints → 404 | Consistent error responses |
| 8 | Stock decremented atomically | Data integrity |
| 9 | No duplicate orders created | Idempotency guarantee |

The script cleans all previous orders and transactions before running, so each execution starts from a clean slate.

## Service Details

- [Customer Service](./services/customer-service/README.md)
- [Product Service](./services/product-service/README.md)
- [Order Service](./services/order-service/README.md)
- [Payment Service](./services/payment-service/README.md)



### Additional

For a more robust microservices in production, we add
- An api gateway
- Manage the containers with kubernetes
- Automate deployment with ci/cd using github workflows and argocd
- LGTM stack for logs, tracing and metrics
