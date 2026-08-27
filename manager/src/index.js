// Manager entry point: Express HTTP API + WebSocket (PTY terminal + process runner).
import express from 'express';
import cors from 'cors';
import RateLimit from 'express-rate-limit';
import http from 'node:http';
import { Manager } from './core/manager.js';
import { buildRouter } from './api/router.js';
import { attachWebSocket } from './api/ws.js';
import { config } from './config.js';

// Surface startup crashes in the deploy log instead of a silent exit.
process.on('uncaughtException', (err) => {
  console.error('[vps-panel] FATAL uncaughtException:', err && err.stack || err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('[vps-panel] FATAL unhandledRejection:', err && err.stack || err);
  process.exit(1);
});

// Refuse to start with the insecure default secret.
if (!process.env.MC_SESSION_SECRET || config.sessionSecret === 'dev-insecure-secret-change-me') {
  console.error('[vps-panel] FATAL: MC_SESSION_SECRET is not set or is the insecure default.');
  console.error('[vps-panel] Set: openssl rand -hex 32');
  process.exit(1);
}

const manager = new Manager();

// Warn if admin still uses default password.
if (manager.authenticate('admin', 'admin123')) {
  console.warn('[vps-panel] WARNING: admin/admin123 is still active. Change it NOW.');
}

const app = express();

// CORS: restrict in production.
const corsOrigin = process.env.MC_CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : true);
app.use(cors(corsOrigin === false ? {} : { origin: corsOrigin }));

// Security headers.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // CSP: allow inline styles/scripts for SPA, connect to WS on same origin.
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; font-src 'self'");
  next();
});

app.use(express.json({ limit: '1mb' }));

// Global rate limit: 200 req / 15 min.
const limiter = RateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

app.get('/api/health', (req, res) => res.json({
  ok: true,
  uptime: process.uptime(),
  workspaces: manager.store.list('projects').length,
}));
app.use('/api', buildRouter(manager));

// Static dashboard.
const publicDir = config.root + '/public';
app.use(express.static(publicDir, { maxAge: '1h' }));
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(publicDir + '/index.html', (err) => { if (err) next(); });
});

const server = http.createServer(app);
attachWebSocket(server, manager);

server.listen(config.port, config.host, () => {
  console.log(`[vps-panel] Running on http://${config.host}:${config.port}`);
});

process.on('SIGINT', () => {
  console.log('\n[vps-panel] Shutting down...');
  for (const p of manager.processes.processes.values()) { try { p.child && p.child.kill('SIGKILL'); } catch {} }
  process.exit(0);
});
