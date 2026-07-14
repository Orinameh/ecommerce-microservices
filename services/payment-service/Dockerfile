FROM oven/bun:latest AS builder

WORKDIR /app

COPY services/payment-service/package.json services/payment-service/bun.lockb* ./services/payment-service/
COPY shared/package.json shared/bun.lockb* ./shared/

RUN cd services/payment-service && bun install --frozen-lockfile
RUN cd shared && bun install --frozen-lockfile

COPY shared/ ./shared/
COPY services/payment-service/ ./services/payment-service/

RUN cd services/payment-service && bun build src/index.ts --outdir ./dist --target node --external mongoose
RUN cd services/payment-service && bun build src/workers/transaction.worker.ts --outdir ./dist/workers --target node --external mongoose

FROM node:26-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/payment-service/dist ./dist
COPY --from=builder /app/services/payment-service/node_modules ./node_modules
COPY services/payment-service/package.json ./

USER node

EXPOSE 5004

CMD ["node", "dist/index.js"]
