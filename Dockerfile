FROM node:25-bookworm-slim AS client-build
WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
COPY shared/ /build/shared/
RUN npm run build

FROM node:25-bookworm-slim AS server-deps
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && git config --system url."https://github.com/".insteadOf ssh://git@github.com/
WORKDIR /build/server
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:25-bookworm-slim AS game
ENV NODE_ENV=production PORT=8080 STATIC_DIR=/app/client/dist ADS_DIR=/app/uploads/ads
WORKDIR /app/server
COPY --from=server-deps /build/server/node_modules ./node_modules
COPY server/package*.json ./
COPY server/src ./src
COPY server/reconcile-payments.js ./reconcile-payments.js
COPY server/admin-grant.js ./admin-grant.js
COPY shared/ /app/shared/
COPY --from=client-build /build/client/dist /app/client/dist
RUN mkdir -p /app/uploads/ads && chown -R node:node /app/uploads
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
