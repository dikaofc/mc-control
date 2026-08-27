# VPS Panel — Web-based terminal + file manager.
# Full VPS environment: bash, python3, node, git, build tools.
FROM debian:bookworm-slim AS base
WORKDIR /app

# Install common runtimes and tools for a real VPS environment.
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash-completion curl wget git unzip tar ca-certificates gnupg lsb-release \
        build-essential python3 python3-pip python3-venv pkg-config \
        procps htop tmux \
    && rm -rf /var/lib/apt/lists/*

# Install latest Node.js LTS via NodeSource.
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ---- install manager deps ----
FROM base AS manager-deps
WORKDIR /app/manager
COPY manager/package.json manager/package-lock.json* ./
# Build node-pty from source so the native binding matches this exact Node ABI.
RUN npm install --omit=dev \
    && npm rebuild node-pty --build-from-source \
    && npm cache clean --force

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
ENV MC_PROJECTS_DIR=/data/projects
# MC_SESSION_SECRET must be set in Railway Variables (a long random string).
# If it is missing or left at the default, the manager refuses to start.

EXPOSE $PORT
STOPSIGNAL SIGTERM
CMD ["node", "src/index.js"]
