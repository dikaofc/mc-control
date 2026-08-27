# Manager service: runs the Node control plane that spawns real Minecraft servers.
FROM node:20-bookworm-slim

# Install a JRE (Java 21) so modern Minecraft (>=1.20.5) can run.
# Debian bookworm has no openjdk-21 in main, so we use bookworm-backports
# (same official Debian mirror). Java 21 also runs older Java 17 MC jars.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates unzip tar \
    && echo "deb http://deb.debian.org/debian bookworm-backports main" > /etc/apt/sources.list.d/backports.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends -t bookworm-backports openjdk-21-jre-headless \
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
