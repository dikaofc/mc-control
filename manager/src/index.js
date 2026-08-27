// Manager entry point: Express HTTP API + WebSocket.
import express from 'express';
import cors from 'cors';
import RateLimit from 'express-rate-limit';
import http from 'node:http';
import { Manager } from './core/manager.js';
import { buildRouter } from './api/router.js';
import { attachWebSocket } from './api/ws.js';
import { startScheduler } from './features/scheduler.js';
import { config } from './config.js';

const manager = new Manager();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const limiter = RateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime(), servers: manager.servers.size }));
app.use('/api', buildRouter(manager));

// Static dashboard (optional, if web/ is built and copied to manager/public).
// SPA fallback: any non-/api GET that isn't a real file serves index.html so
// client-side routes like /server/:id work when the dashboard is co-located.
const publicDir = config.root + '/public';
app.use(express.static(publicDir));
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(publicDir + '/index.html', (err) => { if (err) next(); });
});

const server = http.createServer(app);
attachWebSocket(server, manager);
startScheduler(manager);

// Refuse to boot with the default/insecure session secret. Session tokens would
// be forgeable by anyone. Production MUST set MC_SESSION_SECRET.
if (!process.env.MC_SESSION_SECRET || config.sessionSecret === 'dev-insecure-secret-change-me') {
  console.error('[manager] FATAL: MC_SESSION_SECRET is not set (or still the insecure default).');
  console.error('[manager] Set a long random secret (e.g. `openssl rand -hex 32`) before starting.');
  process.exit(1);
}

server.listen(config.port, config.host, () => {
  console.log(`[manager] listening on http://${config.host}:${config.port}`);
  console.log(`[manager] data dir: ${config.dataDir}`);
});

process.on('SIGINT', () => {
  console.log('\n[manager] shutting down, stopping servers...');
  for (const inst of manager.servers.values()) inst.destroy();
  process.exit(0);
});

export { manager };
