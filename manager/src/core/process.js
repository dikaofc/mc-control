// Generic process runner: run any command (node app.js, python main.py, npm
// run dev, ...) inside a project workspace. Tracks running processes so they
// can be listed and stopped. Output is broadcast over WebSocket.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { Manager } from './manager.js';
import { config } from '../config.js';
import { uid } from '../util/store.js';

export class ProcessManager {
  constructor(manager) {
    this.manager = manager;
    this.processes = new Map(); // id -> { id, projectId, cmd, pid, status, startedAt, child }
  }

  workspaceDir(projectId, userId) {
    const rec = this.manager.store.find('projects', projectId);
    if (!rec) throw new Error('Project not found');
    if (rec.ownerId !== userId && !this.manager._isAdmin(userId)) throw new Error('Forbidden');
    return path.join(config.projectsDir, projectId);
  }

  list(userId) {
    return [...this.processes.values()]
      .filter((p) => p.ownerId === userId || this.manager._isAdmin(userId))
      .map((p) => ({
        id: p.id, projectId: p.projectId, cmd: p.cmd, status: p.status,
        startedAt: p.startedAt, pid: p.child && p.child.pid ? p.child.pid : null,
      }));
  }

  run(projectId, userId, cmd, opts = {}) {
    if (!cmd || !cmd.trim()) throw new Error('command required');
    const cwd = this.workspaceDir(projectId, userId);
    const id = uid('proc');
    const child = spawn('/bin/sh', ['-c', cmd], {
      cwd,
      env: { ...process.env, HOME: process.env.HOME || '/root' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const rec = {
      id, projectId, cmd, ownerId: userId, status: 'running',
      startedAt: Date.now(), child,
    };
    this.processes.set(id, rec);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    const emit = (line) => this.manager._broadcast(projectId, { type: 'process', id, line });
    child.stdout.on('data', (d) => d.split(/\r?\n/).forEach((l) => l && emit(l)));
    child.stderr.on('data', (d) => d.split(/\r?\n/).forEach((l) => l && emit(l)));
    child.on('exit', (code) => {
      rec.status = 'exited';
      this.manager._broadcast(projectId, { type: 'process-exit', id, code });
      this.processes.delete(id);
    });
    child.on('error', (err) => {
      rec.status = 'error';
      this.manager._broadcast(projectId, { type: 'process-exit', id, code: -1, error: err.message });
      this.processes.delete(id);
    });
    return { id, pid: child.pid, status: 'running' };
  }

  stop(id, userId) {
    const rec = this.processes.get(id);
    if (!rec) throw new Error('Process not running');
    if (rec.ownerId !== userId && !this.manager._isAdmin(userId)) throw new Error('Forbidden');
    if (rec.child) { try { rec.child.kill('SIGTERM'); } catch {} }
    this.processes.delete(id);
    return { ok: true };
  }
}
