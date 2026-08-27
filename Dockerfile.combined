# Combined service: Next.js dashboard (static export) served BY the manager.
# One container, one Railway service — most resource-efficient for free tiers.
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Java + tools required to actually run Minecraft servers.
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jre-headless unzip tar ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---- install manager deps ----
FROM base AS manager-deps
WORKDIR /app/manager
COPY manager/package.json manager/package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# ---- build the static dashboard ----
FROM base AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
# NEXT_PUBLIC_MANAGER_URL intentionally empty -> relative API paths (same origin).
RUN npm run build

# ---- runtime ----
FROM base AS runner
WORKDIR /app/manager
COPY --from=manager-deps /app/manager/node_modules ./node_modules
COPY manager/ ./
# Copy the exported dashboard (out/) into manager/public so express serves it.
RUN rm -rf public
COPY --from=web-build /app/web/out ./public

ENV PORT=8090
ENV MC_DATA_DIR=/data
ENV MC_SERVERS_DIR=/data/servers
ENV MC_CACHE_DIR=/data/cache
ENV MC_BACKUPS_DIR=/data/backups

VOLUME ["/data"]
EXPOSE $PORT
STOPSIGNAL SIGTERM
CMD ["node", "src/index.js"]
