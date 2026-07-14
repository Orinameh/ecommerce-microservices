FROM oven/bun:latest AS builder

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun build src/index.ts --outdir ./dist --target node
RUN bun build src/workers/transaction.worker.ts --outdir ./dist/workers --target node

FROM node:26-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

USER node

EXPOSE 5004

CMD ["node", "dist/index.js"]
