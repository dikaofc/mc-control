// Scheduler: run commands or start/stop at intervals (cron-like). Stored per server.
import { uid } from '../util/store.js';

export function listTasks(manager, serverId, userId) {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  return rec.schedule || [];
}

export function addTask(manager, serverId, userId, task) {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  const entry = {
    id: 'task_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: task.name || 'task',
    interval: task.interval || 'daily', // one of: startup, daily, hourly, every30m, custom(seconds)
    action: task.action || 'command', // command | start | stop
    payload: task.payload || '',
    enabled: task.enabled !== false,
  };
  const schedule = rec.schedule || [];
  schedule.push(entry);
  manager.store.update('servers', serverId, { schedule });
  // apply immediately if start/stop
  if (entry.enabled) {
    if (entry.action === 'start') manager.startServer(serverId, userId).catch(() => {});
    if (entry.action === 'stop') manager.stopServer(serverId, userId).catch(() => {});
  }
  return entry;
}

export function updateTask(manager, serverId, userId, taskId, patch) {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  const schedule = (rec.schedule || []).map((t) => (t.id === taskId ? { ...t, ...patch } : t));
  manager.store.update('servers', serverId, { schedule });
  return schedule.find((t) => t.id === taskId);
}

export function removeTask(manager, serverId, userId, taskId) {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  const schedule = (rec.schedule || []).filter((t) => t.id !== taskId);
  manager.store.update('servers', serverId, { schedule });
  return { ok: true };
}

const INTERVALS_MS = {
  every5m: 5 * 60000,
  every15m: 15 * 60000,
  every30m: 30 * 60000,
  hourly: 3600000,
  daily: 86400000,
};

// Global tick that fires scheduled recurring tasks.
export function startScheduler(manager) {
  setInterval(() => {
    const now = Date.now();
    for (const rec of manager.store.list('servers')) {
      const tasks = rec.schedule || [];
      for (const t of tasks) {
        if (!t.enabled) continue;
        const ms = INTERVALS_MS[t.interval];
        if (!ms) continue;
        if (!t.lastRun || now - t.lastRun >= ms) {
          t.lastRun = now;
          try {
            if (t.action === 'command' && t.payload) manager.sendCommand(rec.id, rec.ownerId, t.payload);
            else if (t.action === 'start') manager.startServer(rec.id, rec.ownerId).catch(() => {});
            else if (t.action === 'stop') manager.stopServer(rec.id, rec.ownerId).catch(() => {});
          } catch {}
        }
      }
    }
  }, 30000);
}
