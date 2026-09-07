FROM oven/bun:1.2.10-alpine AS builder

WORKDIR /app

COPY services/payment-service/package.json services/payment-service/bun.lock* ./services/payment-service/
COPY shared/package.json shared/bun.lock* ./shared/

RUN cd services/payment-service && bun install --frozen-lockfile || bun install
RUN cd shared && bun install --frozen-lockfile || bun install

COPY shared/ ./shared/
COPY services/payment-service/ ./services/payment-service/

RUN cd services/payment-service && bun build src/index.ts --outdir ./dist --target node --external mongoose
RUN cd services/payment-service && bun build src/workers/transaction.worker.ts --outdir ./dist/workers --target node --external mongoose

FROM node:26-alpine AS runner

RUN apk add --no-cache wget

WORKDIR /app

COPY --from=builder /app/services/payment-service/dist ./dist
COPY --from=builder /app/services/payment-service/node_modules ./node_modules
COPY services/payment-service/package.json ./

RUN npm prune --omit=dev || true

USER node

EXPOSE 5004

HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://localhost:5004/health || exit 1

CMD ["node", "dist/index.js"]
