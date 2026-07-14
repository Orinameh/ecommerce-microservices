FROM oven/bun:latest AS builder

WORKDIR /app

COPY services/product-service/package.json services/product-service/bun.lockb* ./services/product-service/
COPY shared/package.json shared/bun.lockb* ./shared/

RUN cd services/product-service && bun install --frozen-lockfile
RUN cd shared && bun install --frozen-lockfile

COPY shared/ ./shared/
COPY services/product-service/ ./services/product-service/

RUN cd services/product-service && bun build src/index.ts --outdir ./dist --target node --external mongoose

FROM node:26-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/product-service/dist ./dist
COPY --from=builder /app/services/product-service/node_modules ./node_modules
COPY services/product-service/package.json ./

USER node

EXPOSE 5002

CMD ["node", "dist/index.js"]
