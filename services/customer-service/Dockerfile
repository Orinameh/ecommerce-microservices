FROM oven/bun:latest AS builder

WORKDIR /app

COPY services/customer-service/package.json services/customer-service/bun.lockb* ./services/customer-service/
COPY shared/package.json shared/bun.lockb* ./shared/

RUN cd services/customer-service && bun install --frozen-lockfile
RUN cd shared && bun install --frozen-lockfile

COPY shared/ ./shared/
COPY services/customer-service/ ./services/customer-service/

RUN cd services/customer-service && bun build src/index.ts --outdir ./dist --target node --external mongoose

FROM node:26-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/customer-service/dist ./dist
COPY --from=builder /app/services/customer-service/node_modules ./node_modules
COPY services/customer-service/package.json ./

USER node

EXPOSE 5001

CMD ["node", "dist/index.js"]
