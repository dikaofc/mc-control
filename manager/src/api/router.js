// Express API router for the manager.
import express from 'express';
import { Manager } from '../core/manager.js';
import { authMiddleware } from './auth.js';
import { handleInstall } from './install.js';
import { softwareCatalog, listVersions } from '../core/software.js';
import * as files from '../features/files.js';
import * as backups from '../features/backups.js';
import * as players from '../features/players.js';
import * as plugins from '../features/plugins.js';
import * as scheduler from '../features/scheduler.js';

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
    const { username, password, role } = req.body;
    if (!username || !password) throw new Error('username and password required');
    const u = manager.registerUser(username, password, role);
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

  // --- catalog ------------------------------------------------------------
  router.get('/software', wrap(async () => softwareCatalog()));
  router.get('/software/:software/versions', wrap(async (req) => {
    return listVersions(req.params.software);
  }));

  // --- servers ------------------------------------------------------------
  router.get('/servers', auth, wrap(async (req) => manager.listServers(req.user.id)));
  router.post('/servers', auth, wrap(async (req) => manager.createServer(req.body, req.user.id)));
  router.get('/servers/:id', auth, wrap(async (req) => {
    const s = manager.getServer(req.params.id, req.user.id);
    if (!s) throw new Error('Server not found');
    return s;
  }));
  router.patch('/servers/:id', auth, wrap(async (req) => manager.updateServer(req.params.id, req.body, req.user.id)));
  router.delete('/servers/:id', auth, wrap(async (req) => manager.deleteServer(req.params.id, req.user.id)));

  router.post('/servers/:id/install', auth, wrap(async (req) => {
    const { software, version } = req.body;
    if (!software || !version) throw new Error('software and version required');
    return handleInstall(manager, req.params.id, req.user.id, software, version);
  }));

  router.post('/servers/:id/start', auth, wrap(async (req) => manager.startServer(req.params.id, req.user.id)));
  router.post('/servers/:id/stop', auth, wrap(async (req) => manager.stopServer(req.params.id, req.user.id, !!req.body.force)));
  router.post('/servers/:id/restart', auth, wrap(async (req) => manager.restartServer(req.params.id, req.user.id)));
  router.post('/servers/:id/command', auth, wrap(async (req) => {
    const { command } = req.body;
    if (!command) throw new Error('command required');
    return manager.sendCommand(req.params.id, req.user.id, command);
  }));
  router.get('/servers/:id/console', auth, wrap(async (req) => ({
    lines: manager.getConsole(req.params.id, req.user.id, Number(req.query.tail) || 500),
  })));

  // --- files --------------------------------------------------------------
  router.get('/servers/:id/files', auth, wrap(async (req) => files.listFiles(manager, req.params.id, req.user.id, req.query.path || '')));
  router.get('/servers/:id/files/read', auth, wrap(async (req) => files.readFile(manager, req.params.id, req.user.id, req.query.path)));
  router.post('/servers/:id/files/write', auth, wrap(async (req) => files.writeFile(manager, req.params.id, req.user.id, req.body.path, req.body.content)));
  router.post('/servers/:id/files/create', auth, wrap(async (req) => files.createPath(manager, req.params.id, req.user.id, req.body.path, !!req.body.isDir)));
  router.delete('/servers/:id/files', auth, wrap(async (req) => files.deletePath(manager, req.params.id, req.user.id, req.query.path)));
  router.post('/servers/:id/files/rename', auth, wrap(async (req) => files.renamePath(manager, req.params.id, req.user.id, req.body.from, req.body.to)));

  // --- backups ------------------------------------------------------------
  router.get('/servers/:id/backups', auth, wrap(async (req) => backups.listBackups(manager, req.params.id, req.user.id)));
  router.post('/servers/:id/backups', auth, wrap(async (req) => backups.createBackup(manager, req.params.id, req.user.id, req.body.name)));
  router.post('/servers/:id/backups/restore', auth, wrap(async (req) => backups.restoreBackup(manager, req.params.id, req.user.id, req.body.name)));
  router.delete('/servers/:id/backups', auth, wrap(async (req) => backups.deleteBackup(manager, req.params.id, req.user.id, req.body.name)));

  // --- players ------------------------------------------------------------
  router.get('/servers/:id/players/ops', auth, wrap(async (req) => players.getOps(manager, req.params.id, req.user.id)));
  router.post('/servers/:id/players/ops', auth, wrap(async (req) => players.addOp(manager, req.params.id, req.user.id, req.body.name)));
  router.delete('/servers/:id/players/ops', auth, wrap(async (req) => players.removeOp(manager, req.params.id, req.user.id, req.body.name)));
  router.get('/servers/:id/players/whitelist', auth, wrap(async (req) => players.getWhitelist(manager, req.params.id, req.user.id)));
  router.post('/servers/:id/players/whitelist', auth, wrap(async (req) => players.addWhitelist(manager, req.params.id, req.user.id, req.body.name)));
  router.delete('/servers/:id/players/whitelist', auth, wrap(async (req) => players.removeWhitelist(manager, req.params.id, req.user.id, req.body.name)));
  router.get('/servers/:id/players/bans', auth, wrap(async (req) => players.getBans(manager, req.params.id, req.user.id)));
  router.post('/servers/:id/players/ban', auth, wrap(async (req) => players.banPlayer(manager, req.params.id, req.user.id, req.body.name, req.body.reason)));
  router.post('/servers/:id/players/unban', auth, wrap(async (req) => players.unbanPlayer(manager, req.params.id, req.user.id, req.body.name)));

  // --- plugins / mods -----------------------------------------------------
  router.get('/addons/search', auth, wrap(async (req) => {
    return plugins.searchAddons(req.query.q || '', req.query.type || 'plugin', req.query.mc || null);
  }));
  router.post('/servers/:id/addons', auth, wrap(async (req) => {
    return plugins.installAddon(manager, req.params.id, req.user.id, req.body.projectId, req.body.type || 'plugin');
  }));

  // --- scheduler ----------------------------------------------------------
  router.get('/servers/:id/schedule', auth, wrap(async (req) => scheduler.listTasks(manager, req.params.id, req.user.id)));
  router.post('/servers/:id/schedule', auth, wrap(async (req) => scheduler.addTask(manager, req.params.id, req.user.id, req.body)));
  router.patch('/servers/:id/schedule/:taskId', auth, wrap(async (req) => scheduler.updateTask(manager, req.params.id, req.user.id, req.params.taskId, req.body)));
  router.delete('/servers/:id/schedule/:taskId', auth, wrap(async (req) => scheduler.removeTask(manager, req.params.id, req.user.id, req.params.taskId)));

  return router;
}
