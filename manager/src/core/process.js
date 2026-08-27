// Generic process runner: run any command (node app.js, python main.py, npm
// run dev, ...) inside a project workspace. Tracks running processes so they
// can be listed and stopped. Output is broadcast over WebSocket.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { Manager } from './manager.js';
import { config } from '../config.js';
import { uid } from '../util/store.js';

// Remove panel/Railway secrets from the environment passed to user processes.
function sanitizeEnv(env) {
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    if (/railway/i.test(k)) continue;        // strip any Railway-injected var
    if (k.toUpperCase() === 'MC_SESSION_SECRET') continue; // never leak signing secret
    out[k] = v;
  }
  return out;
}

export class ProcessManager {
  constructor(manager) {
    this.manager = manager;
    this.processes = new Map(); // id -> { id, projectId, cmd, pid, status, startedAt, child }
    // Bound concurrent processes per user to limit resource exhaustion / abuse.
    this.maxPerUser = Number(process.env.MC_MAX_PROCESSES || 20);
    this._buf = new Map(); // id -> leftover partial line
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
    const running = [...this.processes.values()].filter((p) => p.ownerId === userId && p.status === 'running').length;
    if (running >= this.maxPerUser) throw new Error(`process limit reached (max ${this.maxPerUser})`);
    const cwd = this.workspaceDir(projectId, userId);
    const id = uid('proc');
    // Drop Railway/panel secrets from the child env so a process cannot read
    // MC_SESSION_SECRET or Railway creds via `env` (was a proven root-RCE step).
    const childEnv = sanitizeEnv({ ...process.env, HOME: process.env.HOME || '/data' });
    // Run as an unprivileged user when available (see Dockerfile: appuser).
    const runAs = process.env.MC_RUN_USER || 'appuser';
    const useUnpriv = !opts.asRoot;
    const child = spawn(useUnpriv ? 'runuser' : '/bin/sh',
      useUnpriv ? ['-u', runAs, '--', '/bin/sh', '-c', cmd] : ['-c', cmd], {
      cwd,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const rec = {
      id, projectId, cmd, ownerId: userId, status: 'running',
      startedAt: Date.now(), child,
    };
    this.processes.set(id, rec);
    this._buf.set(id, '');
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    const emit = (line) => this.manager._broadcast(projectId, { type: 'process', id, line });
    // Buffer by newline so partial trailing chunks are flushed on the next chunk.
    const drain = (stream, chunk) => {
      let buf = this._buf.get(id) + chunk;
      const parts = buf.split(/\r?\n/);
      this._buf.set(id, parts.pop()); // keep the trailing partial line
      for (const l of parts) emit(l);
    };
    child.stdout.on('data', (d) => drain('stdout', d));
    child.stderr.on('data', (d) => drain('stderr', d));
    child.on('exit', (code) => {
      const tail = this._buf.get(id);
      if (tail) emit(tail);
      this._buf.delete(id);
      rec.status = 'exited';
      this.manager._broadcast(projectId, { type: 'process-exit', id, code });
      this.processes.delete(id);
    });
    child.on('error', (err) => {
      this._buf.delete(id);
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
