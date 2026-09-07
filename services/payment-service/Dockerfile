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

RUN apk update && apk upgrade --no-cache && apk add --no-cache wget && rm -rf /var/cache/apk/*
# Fix npm High vulns (tar/brace-expansion) in base image's npm 11.19.0 — update to latest
RUN npm install -g npm@latest && npm cache clean --force

WORKDIR /app

COPY --from=builder /app/services/payment-service/dist ./dist
COPY --from=builder /app/services/payment-service/node_modules ./node_modules
COPY services/payment-service/package.json ./

RUN npm prune --omit=dev || true
RUN npm audit fix --omit=dev || npm update brace-expansion ip-address tar --omit=dev || true
# Remove npm itself from final image - its bundled tar/brace-expansion are HIGH vulns not needed at runtime (only node is needed)
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx || true

USER node

EXPOSE 5004

HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://localhost:5004/health || exit 1

CMD ["node", "dist/index.js"]
