# Payment Service

Handles payment processing and publishes transaction events to RabbitMQ. For demonstration purposes — no real payment processing is implemented (simulates success).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/payments/process` | Process a payment |
| GET | `/api/payments/transactions` | List all transactions |
| GET | `/api/payments/transactions/:id` | Get transaction by ID |
| GET | `/health` | Health check |

## Payment Flow

1. Check idempotency (by `idempotencyKey`)
2. Create transaction in MongoDB (status: `pending`)
3. Simulate payment (always succeeds)
4. Update transaction to `completed`
5. Publish transaction details to RabbitMQ `transaction_queue`

## Transaction Worker

A background worker (`src/workers/transaction.worker.ts`) consumes messages from the `transaction_queue` and persists transaction history. Built as a separate entry point in the Dockerfile.

## RabbitMQ

- **Queue**: `transaction_queue` (durable, persistent messages)
- **Prefetch**: 1 (fair dispatch)
- **Acknowledgement**: Manual
- **Poison messages**: Messages that fail processing are retried up to 3 times, then discarded to prevent infinite loops

## Environment Variables

| Variable | Default |
|----------|---------|
| `PORT` | `5004` |
| `MONGODB_URI` | `mongodb://admin:password@mongodb:27017/ecommerce?authSource=admin` |
| `RABBITMQ_URL` | `amqp://rabbitmq:5672` |
| `ORDER_SERVICE_URL` | `http://order-service:5003` |
| `TRANSACTION_QUEUE` | `transaction_queue` |
