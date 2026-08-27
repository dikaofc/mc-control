# VPS Panel — Web Terminal & File Manager

A self-hostable **web-based VPS terminal + file manager**. Full Linux environment in your browser — run anything (Node.js, Python, Bash, etc.), manage files, monitor system resources.

## Features

- **🖥️ Full Terminal**: Real PTY shell (bash) via WebSocket. Supports vim, htop, tmux — anything that needs a TTY.
- **📁 File Manager**: Browse, edit, create, delete, upload files in your workspace.
- **⚡ Process Runner**: Run any command in the background — `node app.js`, `python main.py`, `npm run dev`, `apt install ...`. Output streams live.
- **📊 System Monitor**: Live CPU, memory, disk usage, OS info, available runtimes.
- **🔐 Auth**: Multi-user with scrypt password hashing + HMAC-signed sessions.
- **📦 Workspaces**: Isolated directories, each with its own terminal and file manager.

## Pre-installed Runtimes

The Docker image includes everything you need:
- **Node.js 20 LTS** (npm, npx)
- **Python 3** (pip, venv)
- **Bash** (with completion)
- **Git**
- **Build tools** (gcc, make, etc.)
- **Utilities** (curl, wget, htop, tmux)

## Quick Start

### Option A: Combined (single container — recommended)

```bash
docker build -t vps-panel .
docker run -p 8090:8090 \
  -e MC_SESSION_SECRET=$(openssl rand -hex 32) \
  -v vps-data:/data \
  vps-panel
```

Open http://localhost:8090 — login with `admin / admin123`.

### Option B: Docker Compose

```yaml
version: '3.8'
services:
  vps:
    build: .
    ports:
      - "8090:8090"
    environment:
      - MC_SESSION_SECRET=change-me-to-a-random-string
    volumes:
      - vps-data:/data

volumes:
  vps-data:
```

### Option C: Run directly

```bash
# Manager
cd manager
npm install
npm start    # http://localhost:8080

# Web (optional, if you want separate dashboard)
cd web
npm install
export NEXT_PUBLIC_MANAGER_URL=http://localhost:8080
npm run dev  # http://localhost:3000
```

## Deploy to Railway

Railway runs long-lived containers with WebSocket + volumes — perfect for this.

```bash
# Set environment variables in Railway dashboard:
# MC_SESSION_SECRET = <random string>
# Volume /data is mounted automatically.
```

The `railway.toml` defines a `combined` service that builds and deploys everything in one container.

## Deploy to any VPS

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Build and run
docker build -t vps-panel .
docker run -d \
  --name vps-panel \
  -p 8090:8090 \
  -e MC_SESSION_SECRET=$(openssl rand -hex 32) \
  -v /data:/data \
  --restart unless-stopped \
  vps-panel
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8090` | HTTP/WS listen port |
| `HOST` | `0.0.0.0` | Bind interface |
| `MC_SESSION_SECRET` | `dev-...` | **Required in production** — session signing key |
| `MC_DATA_DIR` | `manager/data` | Database + workspace root |
| `MC_PROJECTS_DIR` | `data/projects` | Per-workspace directories |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/register` | Register new user |
| `GET` | `/api/auth/me` | Current user info |
| `GET` | `/api/system` | System info (CPU, RAM, disk) |
| `GET` | `/api/projects` | List workspaces |
| `POST` | `/api/projects` | Create workspace |
| `GET` | `/api/projects/:id` | Get workspace |
| `GET` | `/api/projects/:id/files` | List files |
| `GET` | `/api/projects/:id/files/read` | Read file |
| `POST` | `/api/projects/:id/files/write` | Write file |
| `POST` | `/api/projects/:id/processes` | Run command |
| `WS` | `/ws?mode=terminal&projectId=...` | PTY terminal |

## WebSocket Protocol

Connect to `ws://host/ws?mode=terminal&projectId=ID&token=TOKEN`.

**Client → Server:**
```json
{ "type": "data", "data": "ls -la\n" }
{ "type": "resize", "cols": 120, "rows": 40 }
```

**Server → Client:**
```json
{ "type": "data", "data": "total 48\ndrwxr-xr-x 6..." }
{ "type": "exit" }
```

## Project Layout

```
manager/                  # Backend (Node.js + Express + WebSocket)
  src/api/router.js       #   REST API routes
  src/api/ws.js           #   WebSocket handler
  src/core/terminal.js    #   PTY terminal (node-pty)
  src/core/process.js     #   Background process runner
  src/features/files.js   #   File manager backend
web/                       # Frontend (Next.js)
  src/app/                 #   Pages: login, workspaces, account
  src/components/          #   Terminal, Files, Processes, System tabs
  src/lib/api.js           #   API + WebSocket client
```

## License

MIT
