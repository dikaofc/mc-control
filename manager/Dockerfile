# Manager service: runs the Node control plane (terminal + process runner + files).
# No Java — this is a general VPS panel, not a Minecraft server.
# node-pty needs native build tools (build-essential, python3, g++) at install time.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg \
        build-essential python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

# Railway injects PORT; 8090 is the internal default.
ENV PORT=8090
ENV MC_DATA_DIR=/data
ENV MC_PROJECTS_DIR=/data/projects

# /data is the mounted Railway volume (persists projects).
# No VOLUME instruction — Railway mounts it via railway.toml.

EXPOSE $PORT

# Graceful shutdown so running processes are stopped cleanly.
STOPSIGNAL SIGTERM

CMD ["node", "src/index.js"]
