# Product Service

Manages product inventory with stock reservation capabilities. Self-contained — does not call other services.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List all products |
| GET | `/api/products/:id` | Get product by ID |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| POST | `/api/products/reserve` | Reserve stock (atomic decrement) |
| POST | `/api/products/release` | Release stock (atomic increment) |
| GET | `/health` | Health check |

## Environment Variables

| Variable | Default |
|----------|---------|
| `PORT` | `5002` |
| `MONGODB_URI` | `mongodb://admin:password@mongodb:27017/ecommerce?authSource=admin` |
| `NODE_ENV` | `development` |
| `LOG_LEVEL` | `info` |

## Stock Management

Stock operations use MongoDB's `$inc` for atomic updates, preventing race conditions under concurrent requests.

- **reserve** decrements stock by `quantity`; throws `Insufficient stock` if result goes negative
- **release** increments stock by `quantity`
