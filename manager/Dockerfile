# Manager service: runs the Node control plane that spawns real Minecraft servers.
FROM node:20-bookworm-slim

# Install a JRE (Java 21) so modern Minecraft (>=1.20.5) can run.
# Debian bookworm has no openjdk-21 in main and backports lacks it too, so we
# use Eclipse Temurin 21 from Adoptium's apt repo (proven reachable in build).
# Java 21 also runs older Java 17 MC jars.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg unzip tar \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /etc/apt/keyrings/adoptium.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb $(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main" > /etc/apt/sources.list.d/adoptium.list \
    && apt-get update && apt-get install -y --no-install-recommends temurin-21-jre \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

# Railway injects PORT; 8090 is the internal default.
ENV PORT=8090
ENV MC_DATA_DIR=/data
ENV MC_SERVERS_DIR=/data/servers
ENV MC_CACHE_DIR=/data/cache
ENV MC_BACKUPS_DIR=/data/backups

# /data is the mounted Railway volume (persists worlds, backups, db).
# No VOLUME instruction — Railway mounts it via railway.toml.

EXPOSE $PORT

# Graceful shutdown so running MC servers are stopped cleanly.
STOPSIGNAL SIGTERM

CMD ["node", "src/index.js"]
