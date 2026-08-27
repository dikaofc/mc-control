// Manager entry point: Express HTTP API + WebSocket (PTY terminal + process runner).
import express from 'express';
import cors from 'cors';
import RateLimit from 'express-rate-limit';
import http from 'node:http';
import { Manager } from './core/manager.js';
import { buildRouter } from './api/router.js';
import { attachWebSocket } from './api/ws.js';
import { config } from './config.js';

// Refuse to start with the insecure default secret — session tokens would be
// forgeable by anyone who knows the (public) default.
if (!process.env.MC_SESSION_SECRET || config.sessionSecret === 'dev-insecure-secret-change-me') {
  console.error('[vps-panel] FATAL: MC_SESSION_SECRET is not set or is the insecure default.');
  console.error('[vps-panel] Set a long random secret (e.g. `openssl rand -hex 32`) in your environment before starting.');
  process.exit(1);
}

const manager = new Manager();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const limiter = RateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

app.get('/api/health', (req, res) => res.json({
  ok: true,
  uptime: process.uptime(),
  workspaces: manager.store.list('projects').length,
  platform: process.platform,
}));
app.use('/api', buildRouter(manager));

// Static dashboard (optional, if web/ is built and copied to manager/public).
// SPA fallback: any non-/api GET that isn't a real file serves index.html.
const publicDir = config.root + '/public';
app.use(express.static(publicDir));
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(publicDir + '/index.html', (err) => { if (err) next(); });
});

const server = http.createServer(app);
attachWebSocket(server, manager);

server.listen(config.port, config.host, () => {
  console.log(`[vps-panel] ✅ Running on http://${config.host}:${config.port}`);
  console.log(`[vps-panel] 📂 Data dir: ${config.dataDir}`);
  console.log(`[vps-panel] 🔧 Workspaces: ${config.projectsDir}`);
});

process.on('SIGINT', () => {
  console.log('\n[vps-panel] Shutting down...');
  for (const p of manager.processes.processes.values()) { try { p.child && p.child.kill('SIGKILL'); } catch {} }
  process.exit(0);
});
