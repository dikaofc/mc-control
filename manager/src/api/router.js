// Express API router for the VPS control panel manager.
import express from 'express';
import RateLimit from 'express-rate-limit';
import http from 'node:http';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { Manager } from '../core/manager.js';
import { authMiddleware } from './auth.js';
import { config } from '../config.js';
import { createWsToken } from './ws.js';
import * as files from '../features/files.js';

export function buildRouter(manager) {
  const router = express.Router();
  const auth = authMiddleware(manager);
  router.use(express.json({ limit: '5mb' }));

  const wrap = (fn) => (req, res) => {
    Promise.resolve(fn(req, res)).then((data) => {
      if (data !== undefined) res.json(data);
    }).catch((err) => {
      const status = /not found/i.test(err.message) ? 404
        : /forbidden/i.test(err.message) ? 403
        : /exists|already/i.test(err.message) ? 409 : 400;
      res.status(status).json({ error: err.message });
    });
  };

  // Brute-force protection on auth endpoints (per IP).
  const authLimiter = RateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, slow down.' },
  });

  // --- auth ---------------------------------------------------------------
  router.post('/auth/register', authLimiter, wrap(async (req) => {
    if (!config.allowRegister) throw new Error('Registration is disabled');
    const { username, password } = req.body;
    if (!username || !password) throw new Error('username and password required');
    const u = manager.registerUser(username, password);
    return { token: manager.issueSession(u), user: { id: u.id, username: u.username, role: u.role } };
  }));

  router.post('/auth/login', authLimiter, wrap(async (req) => {
    const { username, password } = req.body;
    const u = manager.authenticate(username, password);
    if (!u) throw new Error('Invalid credentials');
    return { token: manager.issueSession(u), user: { id: u.id, username: u.username, role: u.role } };
  }));

  router.get('/auth/me', auth, wrap(async (req) => ({
    user: { id: req.user.id, username: req.user.username, role: req.user.role },
  })));

  router.post('/auth/change-password', auth, wrap(async (req) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new Error('currentPassword and newPassword required');
    manager.changePassword(req.user.id, currentPassword, newPassword);
    return { ok: true, message: 'Password changed successfully' };
  }));

  // --- WebSocket token exchange (avoids session token in URL logs) ------
  router.post('/auth/ws-token', auth, wrap(async (req) => {
    const token = createWsToken(req.user.id);
    return { token, expiresIn: 300 };
  }));

  // --- projects (workspaces) ---------------------------------------------
  router.get('/projects', auth, wrap(async (req) => manager.listProjects(req.user.id)));
  router.post('/projects', auth, wrap(async (req) => manager.createProject(req.body, req.user.id)));
  router.get('/projects/:id', auth, wrap(async (req) => {
    const p = manager.getProject(req.params.id, req.user.id);
    if (!p) throw new Error('Project not found');
    return p;
  }));
  router.patch('/projects/:id', auth, wrap(async (req) => manager.renameProject(req.params.id, req.user.id, req.body.name)));
  router.delete('/projects/:id', auth, wrap(async (req) => manager.deleteProject(req.params.id, req.user.id)));

  // --- files --------------------------------------------------------------
  router.get('/projects/:id/files', auth, wrap(async (req) => files.listFiles(manager, req.params.id, req.user.id, req.query.path || '')));
  router.get('/projects/:id/files/read', auth, wrap(async (req) => files.readFile(manager, req.params.id, req.user.id, req.query.path)));
  router.post('/projects/:id/files/write', auth, wrap(async (req) => files.writeFile(manager, req.params.id, req.user.id, req.body.path, req.body.content)));
  router.post('/projects/:id/files/create', auth, wrap(async (req) => files.createPath(manager, req.params.id, req.user.id, req.body.path, !!req.body.isDir)));
  router.delete('/projects/:id/files', auth, wrap(async (req) => files.deletePath(manager, req.params.id, req.user.id, req.query.path)));
  router.post('/projects/:id/files/rename', auth, wrap(async (req) => files.renamePath(manager, req.params.id, req.user.id, req.body.from, req.body.to)));

  // --- system info ------------------------------------------------------
  router.get('/system', auth, wrap(async () => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    let disk = { total: 0, used: 0, free: 0 };
    try {
      const df = execSync('df -B1 / | tail -1', { encoding: 'utf8' }).trim().split(/\s+/);
      disk = { total: Number(df[1]) || 0, used: Number(df[2]) || 0, free: Number(df[3]) || 0 };
    } catch {}
    let osInfo = '';
    try { osInfo = execSync('cat /etc/os-release 2>/dev/null | head -2', { encoding: 'utf8' }).trim(); } catch {}
    let uptime = '';
    try { uptime = execSync('uptime -p', { encoding: 'utf8' }).trim(); } catch { uptime = Math.floor(os.uptime()) + 's'; }
    let nodeVer = '', pythonVer = '';
    try { nodeVer = execSync('node --version', { encoding: 'utf8' }).trim(); } catch {}
    try { pythonVer = execSync('python3 --version', { encoding: 'utf8' }).trim(); } catch {}
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      osInfo,
      uptime,
      cpu: {
        model: cpus[0]?.model || 'unknown',
        cores: cpus.length,
        speed: cpus[0]?.speed || 0,
        usage: Math.round((1 - os.loadavg()[0] / cpus.length) * 100),
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        percent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      disk,
      runtimes: { node: nodeVer, python: pythonVer },
      loadAvg: os.loadavg(),
    };
  }));

  // --- processes (run anything: node, python, npm, ...) ------------------
  router.get('/projects/:id/processes', auth, wrap(async (req) => manager.processes.list(req.user.id)));
  router.post('/projects/:id/processes', auth, wrap(async (req) => {
    const { command } = req.body;
    if (!command) throw new Error('command required');
    return manager.processes.run(req.params.id, req.user.id, command);
  }));
  router.delete('/projects/:id/processes/:pid', auth, wrap(async (req) => manager.processes.stop(req.params.pid, req.user.id)));

  // --- exposed ports (reverse proxy through the single public $PORT) ------
  // Railway exposes only one port. To "open" an app running inside a workspace
  // (e.g. `node app.js` on :3000), we proxy /api/projects/:id/proxy/<port> to
  // localhost:<port> inside the container. No extra infra, no third-party tunnel.
  // Persisted on the project record so it survives container restarts.
  const exposedPorts = (id) => new Set(manager.getExposedPorts(id));

  router.get('/projects/:id/ports', auth, wrap(async (req) => {
    const p = manager.getProject(req.params.id, req.user.id);
    if (!p) throw new Error('Project not found');
    return [...exposedPorts(req.params.id)];
  }));

  router.post('/projects/:id/ports', auth, wrap(async (req) => {
    const p = manager.getProject(req.params.id, req.user.id);
    if (!p) throw new Error('Project not found');
    const port = Number(req.body.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('port must be 1-65535');
    const set = exposedPorts(req.params.id);
    set.add(port);
    manager.setExposedPorts(req.params.id, [...set]);
    return [...set];
  }));

  router.delete('/projects/:id/ports/:port', auth, wrap(async (req) => {
    const p = manager.getProject(req.params.id, req.user.id);
    if (!p) throw new Error('Project not found');
    const port = Number(req.params.port);
    const set = exposedPorts(req.params.id);
    set.delete(port);
    manager.setExposedPorts(req.params.id, [...set]);
    return [...set];
  }));

  // Proxy to a locally-listening port inside the workspace's container.
  router.all('/projects/:id/proxy/:port', auth, (req, res) => {
    const port = Number(req.params.port);
    if (!exposedPorts(req.params.id).has(port)) {
      return res.status(404).json({ error: 'Port not exposed' });
    }
    const target = http.request(
      { host: '127.0.0.1', port, method: req.method, path: req.originalUrl.replace(/.*\/proxy\/\d+/, '/'), headers: stripHop(req.headers) },
      (up) => {
        res.status(up.statusCode);
        for (const [k, v] of Object.entries(up.headers)) {
          if (!/connection|transfer-encoding/i.test(k)) res.setHeader(k, v);
        }
        up.pipe(res);
      }
    );
    target.on('error', () => res.status(502).json({ error: 'Upstream not listening on this port' }));
    req.pipe(target);
  });

  return router;
}

// Remove hop-by-hop headers before forwarding (avoid proxy loops / broken framing).
function stripHop(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!/^(connection|keep-alive|transfer-encoding|upgrade|proxy-)/i.test(k)) out[k] = v;
  }
  return out;
}
