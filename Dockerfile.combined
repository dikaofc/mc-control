# Combined service: Next.js dashboard (static export) served BY the manager.
# One container, one Railway service — most resource-efficient for free tiers.
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Java 21 + tools required to actually run Minecraft servers (>=1.20.5).
# Debian bookworm has no openjdk-21 in main and backports lacks it too, so we
# use Eclipse Temurin 21 from Adoptium's apt repo (proven reachable in build).
# Java 21 also runs older Java 17 MC jars, so one JDK covers all versions.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg unzip tar \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /etc/apt/keyrings/adoptium.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb $(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main" > /etc/apt/sources.list.d/adoptium.list \
    && apt-get update && apt-get install -y --no-install-recommends temurin-21-jre \
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

EXPOSE $PORT
STOPSIGNAL SIGTERM
CMD ["node", "src/index.js"]
