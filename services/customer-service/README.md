# Customer Service

Manages customer data. Self-contained — does not call other services.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/customers` | List all customers |
| GET | `/api/customers/:id` | Get customer by ID |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Delete customer |
| GET | `/health` | Health check |

## Environment Variables

| Variable | Default |
|----------|---------|
| `PORT` | `5001` |
| `MONGODB_URI` | `mongodb://admin:password@mongodb:27017/ecommerce?authSource=admin` |
| `NODE_ENV` | `development` |
| `LOG_LEVEL` | `info` |

## Seed Data

On startup, seeds a default customer if none exist:
- **John Doe** (john.doe@example.com)
