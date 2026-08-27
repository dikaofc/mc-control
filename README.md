# MC Control — Minecraft Server Hosting (Aternos-like)

A complete, self-hostable Minecraft **Java & Bedrock** server control plane: a web dashboard
(that deploys to **Vercel**) plus a backend **manager** that actually launches real Minecraft
servers, streams a live console, and manages files, backups, players, plugins/mods and schedules.

> ⚠️ **Architecture note (important).** Vercel is serverless: it cannot run a long-lived Java
> process, has no JVM, and kills processes after 60s (hobby) / 300s (pro). So the **dashboard
> (control plane) runs on Vercel**, while the **manager (data plane) runs on a normal host with
> Java** (a VPS, a PC, a Raspberry Pi, or even this Termux/Android box). They talk over REST +
> WebSocket. This is exactly how Aternos works — website and server fleet are separate.

```
┌──────────────┐         REST + WebSocket          ┌──────────────────────┐
│  Vercel      │  ───────────────────────────────▶ │  Manager (Node.js)   │
│  Dashboard   │   NEXT_PUBLIC_MANAGER_URL         │  spawns real Java /  │
│  (Next.js)   │  ◀─────────────────────────────── │  Bedrock processes   │
└──────────────┘   live console + stats            └──────────────────────┘
                                                              │
                                                              ▼
                                                 Real Minecraft server (port 25565…)
```

## Features

- **Full software catalog** (live from official sources): Vanilla, Paper, Purpur, Fabric, Forge,
  Spigot (BuildTools), Bedrock Dedicated. Every version, fetched on demand.
- **Live server control**: start / stop / restart, real-time console over WebSocket, live player
  count, uptime, CPU/memory stats.
- **Settings**: gamemode, difficulty, MOTD, whitelist, PvP, online-mode, view distance, command
  blocks, EULA, memory, port, max players — applied live where possible.
- **File manager**: browse / view / edit / create / delete any server file.
- **Backups**: full `tar.gz` snapshots, restore, delete.
- **Players**: ops, whitelist, bans — via both the JSON files and in-game commands.
- **Plugins / Mods**: search + install from Modrinth (plugins for Paper/Purpur/Spigot, mods for
  Fabric/Forge).
- **Scheduler**: recurring commands or start/stop (every 5/15/30 min, hourly, daily).
- **Auth**: scrypt password hashing + HMAC-signed sessions, multi-user (admin/user).

## Quick start (local)

### 1. Manager (needs Java 17+)

```bash
cd manager
npm install
npm start            # listens on :8080 (set PORT to change)
# default login: admin / admin123   (change it!)
```

Java version requirement depends on the MC version you install:
- Minecraft ≤ 1.20.4 → Java 17
- Minecraft ≥ 1.20.5 (e.g. 1.21.x) → Java 21

### 2. Dashboard (Vercel or local)

```bash
cd web
npm install
# point the dashboard at your manager:
export NEXT_PUBLIC_MANAGER_URL=http://<manager-host>:8080
npm run dev          # http://localhost:3000
```

Open the dashboard, log in, create a server, pick a software + version, **Install**, then **Start**.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Import** the `web` folder as a project (framework = Next.js).
3. Set the environment variable:
   - `NEXT_PUBLIC_MANAGER_URL` = `https://<your-manager-host>` (the public URL of the manager
     below). Must be reachable from browsers and support WebSocket (`wss://`).
4. Deploy. The dashboard builds and serves from Vercel's CDN.

The manager must be deployed separately (see below) — it cannot run on Vercel.

## Deploy the manager

The manager is a plain Node.js service. Run it on any host with Node 18+ and a JRE:

- **VPS / Docker / systemd / a spare machine**, or
- **This Termux/Android box** (already running here on port 8090).

Example systemd unit (manager.service):

```ini
[Unit]
Description=MC Control Manager
After=network.target

[Service]
WorkingDirectory=/opt/mc-control/manager
ExecStart=/usr/bin/node src/index.js
Environment=PORT=8080
Environment=MC_SESSION_SECRET=change-me-to-a-long-random-string
Restart=always
User=mc

[Install]
WantedBy=multi-user.target
```

Expose it with a reverse proxy (Caddy/Nginx) and obtain a TLS cert so the dashboard can use
`wss://`. The manager itself has no built-in TLS.

### Manager environment variables

| Var | Default | Meaning |
|-----|---------|---------|
| `PORT` | `8080` | HTTP/WS listen port |
| `HOST` | `0.0.0.0` | bind interface |
| `MC_SESSION_SECRET` | `dev-…` | **set this in production** (session signing) |
| `MC_DATA_DIR` | `manager/data` | db + server dirs |
| `MC_SERVERS_DIR` | `data/servers` | per-server folders |
| `MC_CACHE_DIR` | `data/cache` | downloaded zips/jars |
| `MC_BACKUPS_DIR` | `data/backups` | backup archives |
| `JAVA_BIN` | `java` | java executable |
| `MC_DEFAULT_MEM` | `1024` | default RAM (MB) |
| `MC_MAX_MEM` | `4096` | RAM cap (MB) |
| `MC_BIND_HOST` | `0.0.0.0` | server listen IP |

## Notes & limitations

- **Bedrock** requires the official Mojang Bedrock dedicated server (Linux x64/arm64). The manager
  downloads and extracts it. Bedrock executable must be marked executable on the host.
- **Spigot** is listed but requires running BuildTools on the host (it compiles from source); the
  UI directs you to do this manually or via a scheduled task.
- **Paper** download uses PaperMC's current distribution. If their API/URL changes, update
  `manager/src/core/software.js`.
- **Modrinth/Hangar** plugin search depends on those public APIs being reachable from the manager
  host.
- The manager stores data in a JSON file (`data/db.json`) — fine for small/self-hosted use. Swap
  `Store` for Postgres/SQLite for larger deployments.

## Project layout

```
manager/                 # control plane backend (Node.js, runs on a Java host)
  src/core/manager.js    #   orchestration, auth, server registry
  src/core/server.js     #   live process spawn + console capture
  src/core/software.js   #   version catalog + jar/zip downloader
  src/features/          #   files, backups, players, plugins, scheduler
  src/api/               #   Express REST + WebSocket
web/                     # dashboard (Next.js, deploys to Vercel)
  src/app/               #   pages: login, server list, server control
  src/components/        #   console, settings, players, files, backups, addons, scheduler
  src/lib/api.js         #   API + WebSocket client
```
