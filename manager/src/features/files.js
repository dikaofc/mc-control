// File manager: list, read, write, create, delete, upload, download within a server dir.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { Manager } from '../core/manager.js';

function serverPath(manager, serverId, userId, rel = '') {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  const base = path.join(config.projectsDir, serverId);
  const target = path.resolve(base, rel || '.'); // prevent traversal
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error('Path escapes server directory');
  }
  return { base, target, rec };
}

const IGNORE = new Set(['session.lock']);

export function listFiles(manager, serverId, userId, rel = '') {
  const { target } = serverPath(manager, serverId, userId, rel);
  if (!fs.existsSync(target)) return [];
  return fs.readdirSync(target, { withFileTypes: true }).map((d) => {
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
  if (fs.statSync(target).isDirectory()) throw new Error('Path is a directory');
  const buf = fs.readFileSync(target);
  return { name: path.basename(target), content: buf.toString('utf8'), size: buf.length };
}

export function writeFile(manager, serverId, userId, rel, content) {
  const { target } = serverPath(manager, serverId, userId, rel);
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
  if (target === path.join(config.projectsDir, serverId)) throw new Error('Cannot delete server root');
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  return { ok: true };
}

export function renamePath(manager, serverId, userId, from, to) {
  const a = serverPath(manager, serverId, userId, from);
  const b = serverPath(manager, serverId, userId, to);
  fs.renameSync(a.target, b.target);
  return { ok: true };
}
