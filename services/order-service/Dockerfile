FROM oven/bun:latest AS builder

WORKDIR /app

COPY services/order-service/package.json services/order-service/bun.lock* ./services/order-service/
COPY shared/package.json shared/bun.lock* ./shared/

RUN cd services/order-service && bun install --frozen-lockfile || bun install
RUN cd shared && bun install --frozen-lockfile || bun install

COPY shared/ ./shared/
COPY services/order-service/ ./services/order-service/

RUN cd services/order-service && bun build src/index.ts --outdir ./dist --target node --external mongoose

FROM node:26-alpine AS runner

RUN apk add --no-cache wget

WORKDIR /app

COPY --from=builder /app/services/order-service/dist ./dist
COPY --from=builder /app/services/order-service/node_modules ./node_modules
COPY services/order-service/package.json ./

USER node

EXPOSE 5003

CMD ["node", "dist/index.js"]
