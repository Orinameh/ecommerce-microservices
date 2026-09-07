FROM oven/bun:1.2.10-alpine AS builder

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

RUN npm prune --omit=dev || true

USER node

EXPOSE 5003

HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://localhost:5003/health || exit 1

CMD ["node", "dist/index.js"]
