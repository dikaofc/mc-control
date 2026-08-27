// The Manager owns users, projects (workspaces) and the process + terminal registries.
import fs from 'node:fs';
import path from 'node:path';
import { Store, uid } from '../util/store.js';
import { createPassword, verifyPassword, createSession, verifyToken } from '../util/auth.js';
import { ProcessManager } from './process.js';
import { config } from '../config.js';

export class Manager {
  constructor() {
    this.store = new Store(path.join(config.dataDir, 'db.json'));
    this.projects = this.store; // projects stored in same db under 'projects'
    this.processes = new ProcessManager(this);
    this._seedAdmin();
    this._wsBroadcast = null;
  }

  // --- users -------------------------------------------------------------
  _seedAdmin() {
    const users = this.store.list('users');
    if (users.length === 0) {
      const id = uid('usr');
      this.store.insert('users', {
        id, username: 'admin', password: createPassword('admin123'),
        role: 'admin', createdAt: Date.now(),
      });
      console.log('[manager] seeded default user: admin / admin123  (change this!)');
    }
  }

  findUserByName(name) { return this.store.list('users').find((u) => u.username === name) || null; }
  findUserById(id) { return this.store.list('users').find((u) => u.id === id) || null; }

  // Self-registration is ALWAYS a normal user. Role is never taken from input.
  registerUser(username, password) {
    if (!username || username.length < 3) throw new Error('Username must be at least 3 characters');
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');
    if (this.findUserByName(username)) throw new Error('Username already exists');
    const id = uid('usr');
    this.store.insert('users', {
      id, username, password: createPassword(password), role: 'user', createdAt: Date.now(),
    });
    return this.findUserById(id);
  }

  authenticate(username, password) {
    const u = this.findUserByName(username);
    if (!u) return null;
    if (!verifyPassword(password, u.password)) return null;
    return u;
  }

  changePassword(userId, currentPassword, newPassword) {
    const u = this.findUserById(userId);
    if (!u) throw new Error('User not found');
    if (!verifyPassword(currentPassword, u.password)) throw new Error('Current password is incorrect');
    if (!newPassword || newPassword.length < 8) throw new Error('New password must be at least 8 characters');
    this.store.update('users', userId, { password: createPassword(newPassword) });
    return true;
  }

  sessionFor(token) {
    const payload = verifyToken(token);
    if (!payload) return null;
    return this.findUserById(payload.uid);
  }
  issueSession(user) { return createSession(user.id, user.username); }

  _isAdmin(userId) { const u = this.findUserById(userId); return u && u.role === 'admin'; }

  // --- projects (workspaces) --------------------------------------------
  listProjects(userId) {
    const all = this.store.list('projects');
    const visible = all.filter((p) => p.ownerId === userId || this._isAdmin(userId));
    return visible.map((p) => this._publicProject(p));
  }

  getProject(id, userId) {
    const rec = this.store.find('projects', id);
    if (!rec) return null;
    if (rec.ownerId !== userId && !this._isAdmin(userId)) return null;
    return this._publicProject(rec);
  }

  _publicProject(r) {
    const dir = path.join(config.projectsDir, r.id);
    let fileCount = 0;
    try { fileCount = fs.readdirSync(dir).length; } catch {}
    return { id: r.id, name: r.name, ownerId: r.ownerId, createdAt: r.createdAt, fileCount };
  }

  createProject(input, userId) {
    const id = uid('prj');
    const record = {
      id, name: input.name || 'My Project', ownerId: userId, createdAt: Date.now(),
    };
    fs.mkdirSync(path.join(config.projectsDir, id), { recursive: true });
    this.store.insert('projects', record);
    return this._publicProject(record);
  }

  renameProject(id, userId, name) {
    const rec = this.store.find('projects', id);
    if (!rec) throw new Error('Project not found');
    if (rec.ownerId !== userId && !this._isAdmin(userId)) throw new Error('Forbidden');
    if (!name || !name.trim()) throw new Error('name required');
    const updated = this.store.update('projects', id, { name: name.trim() });
    return this._publicProject(updated);
  }

  deleteProject(id, userId) {
    const rec = this.store.find('projects', id);
    if (!rec) throw new Error('Project not found');
    if (rec.ownerId !== userId && !this._isAdmin(userId)) throw new Error('Forbidden');
    this.store.remove('projects', id);
    try { fs.rmSync(path.join(config.projectsDir, id), { recursive: true, force: true }); } catch {}
    return true;
  }

  // --- WS broadcast registry (set by api layer) -------------------------
  setBroadcaster(fn) { this._wsBroadcast = fn; }
  _broadcast(projectId, msg) { if (this._wsBroadcast) this._wsBroadcast(projectId, msg); }
}
