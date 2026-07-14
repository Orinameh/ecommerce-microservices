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
4. **Order service** creates order in MongoDB (status: `pending`)
5. **Order service** reserves stock via product-service (`POST /api/products/reserve`)
6. **Order service** sends payment request to payment-service with `productId`
7. **Payment service** creates transaction, publishes to RabbitMQ queue
8. **Transaction worker** consumes the message, persists to transaction history
9. **Order service** updates order to `paid` on success, releases stock on failure

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

## Service Details

- [Customer Service](./services/customer-service/README.md)
- [Product Service](./services/product-service/README.md)
- [Order Service](./services/order-service/README.md)
- [Payment Service](./services/payment-service/README.md)
