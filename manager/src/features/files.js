// File manager: list, read, write, create, delete, upload, download within a server dir.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { Manager } from '../core/manager.js';

function serverPath(manager, serverId, userId, rel = '') {
  const rec = manager.store.find('projects', serverId);
  if (!rec) throw new Error('Workspace not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  const base = path.join(config.projectsDir, serverId);
  const target = path.resolve(base, rel || '.'); // prevent traversal
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error('Path escapes server directory');
  }
  return { base, target, rec };
}

const IGNORE = new Set(['session.lock']);

const MAX_LIST_ENTRIES = 500;

export function listFiles(manager, serverId, userId, rel = '') {
  const { target } = serverPath(manager, serverId, userId, rel);
  if (!fs.existsSync(target)) return [];
  const entries = fs.readdirSync(target, { withFileTypes: true });
  if (entries.length > MAX_LIST_ENTRIES) {
    throw new Error(`Directory has ${entries.length} entries (max ${MAX_LIST_ENTRIES}). Use the terminal.`);
  }
  return entries.map((d) => {
    const p = path.join(target, d.name);
    let size = 0, mtime = 0;
    try { const st = fs.statSync(p); size = st.size; mtime = st.mtimeMs; } catch {}
    return {
      name: d.name,
      path: path.relative(path.join(config.projectsDir, serverId), p),
      isDir: d.isDirectory(),
      size,
      mtime,
    };
  }).filter((f) => !IGNORE.has(f.name)).sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name));
}

export function readFile(manager, serverId, userId, rel) {
  const { target } = serverPath(manager, serverId, userId, rel);
  const stat = fs.statSync(target);
  if (stat.isDirectory()) throw new Error('Path is a directory');
  // Limit read to 2MB to prevent memory exhaustion
  const MAX_READ = 2 * 1024 * 1024;
  if (stat.size > MAX_READ) throw new Error('File too large to read (> 2MB). Use the terminal.');
  const buf = fs.readFileSync(target);
  return { name: path.basename(target), content: buf.toString('utf8'), size: buf.length };
}

const MAX_WRITE = 2 * 1024 * 1024; // 2MB write limit

export function writeFile(manager, serverId, userId, rel, content) {
  const { target } = serverPath(manager, serverId, userId, rel);
  if (typeof content === 'string' && content.length > MAX_WRITE) {
    throw new Error('File too large (> 2MB). Use the terminal.');
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content ?? '');
  return { ok: true, path: rel };
}

export function createPath(manager, serverId, userId, rel, isDir = false) {
  const { target } = serverPath(manager, serverId, userId, rel);
  if (isDir) fs.mkdirSync(target, { recursive: true });
  else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, ''); }
  return { ok: true };
}

export function deletePath(manager, serverId, userId, rel) {
  const { target } = serverPath(manager, serverId, userId, rel);
  if (target === path.join(config.projectsDir, serverId)) throw new Error('Cannot delete workspace root');
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  return { ok: true };
}

export function renamePath(manager, serverId, userId, from, to) {
  const a = serverPath(manager, serverId, userId, from);
  const b = serverPath(manager, serverId, userId, to);
  // Prevent renaming outside workspace
  const base = path.join(config.projectsDir, serverId);
  if (!b.target.startsWith(base + path.sep) && b.target !== base) {
    throw new Error('Path escapes workspace directory');
  }
  fs.renameSync(a.target, b.target);
  return { ok: true };
}
