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

// Static dashboard (optional, if web/ is built and copied to manager/public)
app.use(express.static(config.root + '/public'));

const server = http.createServer(app);
attachWebSocket(server, manager);
startScheduler(manager);

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
