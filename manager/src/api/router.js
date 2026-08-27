// Express API router for the VPS control panel manager.
import express from 'express';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { Manager } from '../core/manager.js';
import { authMiddleware } from './auth.js';
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

  // --- auth ---------------------------------------------------------------
  router.post('/auth/register', wrap(async (req) => {
    const { username, password } = req.body;
    if (!username || !password) throw new Error('username and password required');
    const u = manager.registerUser(username, password);
    return { token: manager.issueSession(u), user: { id: u.id, username: u.username, role: u.role } };
  }));

  router.post('/auth/login', wrap(async (req) => {
    const { username, password } = req.body;
    const u = manager.authenticate(username, password);
    if (!u) throw new Error('Invalid credentials');
    return { token: manager.issueSession(u), user: { id: u.id, username: u.username, role: u.role } };
  }));

  router.get('/auth/me', auth, wrap(async (req) => ({
    user: { id: req.user.id, username: req.user.username, role: req.user.role },
  })));

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

  return router;
}
