FROM oven/bun:1.2.10-alpine AS builder

WORKDIR /app

COPY services/product-service/package.json services/product-service/bun.lock* ./services/product-service/
COPY shared/package.json shared/bun.lock* ./shared/

RUN cd services/product-service && bun install --frozen-lockfile || bun install
RUN cd shared && bun install --frozen-lockfile || bun install

COPY shared/ ./shared/
COPY services/product-service/ ./services/product-service/

RUN cd services/product-service && bun build src/index.ts --outdir ./dist --target node --external mongoose

FROM node:26-alpine AS runner

RUN apk add --no-cache wget

WORKDIR /app

COPY --from=builder /app/services/product-service/dist ./dist
COPY --from=builder /app/services/product-service/node_modules ./node_modules
COPY services/product-service/package.json ./

RUN npm prune --omit=dev || true

USER node

EXPOSE 5002

HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://localhost:5002/health || exit 1

CMD ["node", "dist/index.js"]
