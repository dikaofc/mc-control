// The Manager owns all users, servers, and the process registry.
import fs from 'node:fs';
import path from 'node:path';
import { Store, uid } from '../util/store.js';
import { createPassword, verifyPassword, createSession, verifyToken } from '../util/auth.js';
import { McServer, Status } from './server.js';
import { config } from '../config.js';

export class Manager {
  constructor() {
    this.store = new Store(path.join(config.dataDir, 'db.json'));
    this.servers = new Map(); // id -> McServer
    this.users = this.store; // users stored in same db under 'users'
    this._seedAdmin();
  }

  // --- users -------------------------------------------------------------
  _seedAdmin() {
    const users = this.store.list('users');
    if (users.length === 0) {
      const id = uid('usr');
      this.store.insert('users', {
        id,
        username: 'admin',
        password: createPassword('admin123'),
        role: 'admin',
        createdAt: Date.now(),
      });
      console.log('[manager] seeded default user: admin / admin123  (change this!)');
    }
  }

  findUserByName(name) {
    return this.store.list('users').find((u) => u.username === name) || null;
  }

  findUserById(id) {
    return this.store.list('users').find((u) => u.id === id) || null;
  }

  registerUser(username, password, role = 'user') {
    if (this.findUserByName(username)) throw new Error('Username already exists');
    const id = uid('usr');
    this.store.insert('users', {
      id, username, password: createPassword(password), role, createdAt: Date.now(),
    });
    return this.findUserById(id);
  }

  authenticate(username, password) {
    const u = this.findUserByName(username);
    if (!u) return null;
    if (!verifyPassword(password, u.password)) return null;
    return u;
  }

  sessionFor(token) {
    const payload = verifyToken(token);
    if (!payload) return null;
    return this.findUserById(payload.uid);
  }

  issueSession(user) {
    return createSession(user.id, user.username);
  }

  // --- servers -----------------------------------------------------------
  _serverDir(id) {
    return path.join(config.serversDir, id);
  }

  _jarPath(record) {
    if (record.platform === 'bedrock') {
      return path.join(this._serverDir(record.id), 'bedrock_server');
    }
    return path.join(this._serverDir(record.id), record.jarFile || 'server.jar');
  }

  _dirs(record) {
    return { serverDir: this._serverDir(record.id), jarPath: this._jarPath(record) };
  }

  listServers(userId) {
    const all = this.store.list('servers');
    const visible = userId ? all.filter((s) => s.ownerId === userId || this._isAdmin(userId)) : all;
    return visible.map((r) => this._publicServer(r)).map((p) => {
      const inst = this.servers.get(p.id);
      return { ...p, status: inst ? inst.status : Status.OFFLINE, stats: inst ? inst.stats() : null };
    });
  }

  _isAdmin(userId) {
    const u = this.findUserById(userId);
    return u && u.role === 'admin';
  }

  getServer(id, userId) {
    const record = this.store.find('servers', id);
    if (!record) return null;
    if (record.ownerId !== userId && !this._isAdmin(userId)) return null;
    const inst = this.servers.get(id);
    return {
      ...this._publicServer(record),
      status: inst ? inst.status : Status.OFFLINE,
      stats: inst ? inst.stats() : null,
      config: this._safeConfig(record),
    };
  }

  _publicServer(r) {
    return {
      id: r.id, name: r.name, platform: r.platform, software: r.software,
      version: r.version, port: r.port, createdAt: r.createdAt,
      ownerId: r.ownerId, motd: r.motd,
    };
  }

  // Full config minus the password hash etc. (record already has no pw)
  _safeConfig(r) {
    return {
      name: r.name, platform: r.platform, software: r.software, version: r.version,
      port: r.port, memoryMb: r.memoryMb, maxPlayers: r.maxPlayers, gamemode: r.gamemode,
      difficulty: r.difficulty, onlineMode: r.onlineMode, pvp: r.pvp, whitelist: r.whitelist,
      acceptEula: r.acceptEula, viewDistance: r.viewDistance, commandBlocks: r.commandBlocks,
      allowNether: r.allowNether, spawnProtection: r.spawnProtection, jvmArgs: r.jvmArgs || [],
      installed: r.installed || false,
    };
  }

  async createServer(input, userId) {
    const id = uid('srv');
    const now = Date.now();
    const record = {
      id,
      name: input.name || 'My Server',
      platform: input.platform === 'bedrock' ? 'bedrock' : 'java',
      software: input.software || 'vanilla',
      version: input.version || 'latest',
      port: input.port || (config.defaultPort + this.store.list('servers').length),
      memoryMb: Math.min(input.memoryMb || config.defaultMemoryMb, config.maxMemoryMb),
      maxPlayers: input.maxPlayers || 20,
      gamemode: input.gamemode || 'survival',
      difficulty: input.difficulty || 'easy',
      onlineMode: input.onlineMode !== false,
      pvp: input.pvp !== false,
      whitelist: Boolean(input.whitelist),
      acceptEula: Boolean(input.acceptEula),
      viewDistance: input.viewDistance || 10,
      commandBlocks: Boolean(input.commandBlocks),
      allowNether: input.allowNether !== false,
      spawnProtection: input.spawnProtection || 0,
      jvmArgs: input.jvmArgs || [],
      ownerId: userId,
      createdAt: now,
      installed: false,
      jarFile: 'server.jar',
    };
    fs.mkdirSync(this._serverDir(id), { recursive: true });
    this.store.insert('servers', record);
    return this.getServer(id, userId);
  }

  updateServer(id, patch, userId) {
    const record = this.store.find('servers', id);
    if (!record) throw new Error('Server not found');
    if (record.ownerId !== userId && !this._isAdmin(userId)) throw new Error('Forbidden');
    const allowed = ['name','port','memoryMb','maxPlayers','gamemode','difficulty','onlineMode',
      'pvp','whitelist','acceptEula','viewDistance','commandBlocks','allowNether','spawnProtection',
      'jvmArgs','motd','software','version'];
    const clean = {};
    for (const k of allowed) if (k in patch) clean[k] = patch[k];
    if (clean.memoryMb) clean.memoryMb = Math.min(clean.memoryMb, config.maxMemoryMb);
    const updated = this.store.update('servers', id, clean);
    // If an instance is live, apply relevant live changes
    const inst = this.servers.get(id);
    if (inst) {
      inst.record = updated;
      if (clean.port) inst.ensureServerProperties();
    }
    return this.getServer(id, userId);
  }

  deleteServer(id, userId) {
    const record = this.store.find('servers', id);
    if (!record) throw new Error('Server not found');
    if (record.ownerId !== userId && !this._isAdmin(userId)) throw new Error('Forbidden');
    const inst = this.servers.get(id);
    if (inst) { inst.destroy(); this.servers.delete(id); }
    this.store.remove('servers', id);
    // Remove directory
    try { fs.rmSync(this._serverDir(id), { recursive: true, force: true }); } catch {}
    return true;
  }

  // --- instance lifecycle ------------------------------------------------
  _instance(id) {
    const record = this.store.find('servers', id);
    if (!record) throw new Error('Server not found');
    let inst = this.servers.get(id);
    if (!inst) {
      inst = new McServer(record, this._dirs(record));
      this._wireInstance(inst);
      this.servers.set(id, inst);
    } else {
      inst.record = record;
      inst.dirs = this._dirs(record);
    }
    return inst;
  }

  _wireInstance(inst) {
    inst.on('console', (line) => this._broadcast(inst.id, { type: 'console', line }));
    inst.on('status', (status) => this._broadcast(inst.id, { type: 'status', status }));
    inst.on('players', (players) => this._broadcast(inst.id, { type: 'players', players }));
    inst.on('stats', (stats) => this._broadcast(inst.id, { type: 'stats', stats }));
    inst.on('stop', (info) => {
      this._broadcast(inst.id, { type: 'stop', info });
      this.servers.delete(inst.id);
    });
  }

  // WS broadcast registry (set by api layer)
  _wsBroadcast = null;
  setBroadcaster(fn) { this._wsBroadcast = fn; }
  _broadcast(serverId, msg) {
    if (this._wsBroadcast) this._wsBroadcast(serverId, msg);
  }

  async startServer(id, userId) {
    const record = this.store.find('servers', id);
    if (!record) throw new Error('Server not found');
    if (record.ownerId !== userId && !this._isAdmin(userId)) throw new Error('Forbidden');
    const inst = this._instance(id);
    const res = await inst.start();
    // reflect installed flag
    this.store.update('servers', id, { installed: true });
    inst.maxPlayers = record.maxPlayers || 20;
    return res;
  }

  async stopServer(id, userId, force = false) {
    const record = this.store.find('servers', id);
    if (!record) throw new Error('Server not found');
    if (record.ownerId !== userId && !this._isAdmin(userId)) throw new Error('Forbidden');
    const inst = this.servers.get(id);
    if (!inst) throw new Error('Server not running');
    return inst.stop(force);
  }

  async restartServer(id, userId) {
    const record = this.store.find('servers', id);
    if (!record) throw new Error('Server not found');
    if (record.ownerId !== userId && !this._isAdmin(userId)) throw new Error('Forbidden');
    const inst = this._instance(id);
    return inst.restart();
  }

  sendCommand(id, userId, cmd) {
    const record = this.store.find('servers', id);
    if (!record) throw new Error('Server not found');
    if (record.ownerId !== userId && !this._isAdmin(userId)) throw new Error('Forbidden');
    const inst = this.servers.get(id);
    if (!inst) throw new Error('Server not running');
    return inst.sendCommand(cmd);
  }

  getConsole(id, userId, tail = 500) {
    const record = this.store.find('servers', id);
    if (!record) throw new Error('Server not found');
    if (record.ownerId !== userId && !this._isAdmin(userId)) throw new Error('Forbidden');
    const inst = this.servers.get(id);
    return inst ? inst.consoleBuffer.slice(-tail) : [];
  }

  instance(id) { return this.servers.get(id); }
}

export { Status };
