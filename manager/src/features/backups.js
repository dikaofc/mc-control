// Backups: snapshot the server directory (tar) and restore. Requires `tar`.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { uid } from '../util/store.js';

const execFileAsync = promisify(execFile);

// Only allow safe backup filenames: no slashes, no "..", no nulls.
function safeBackupName(name) {
  if (typeof name !== 'string' || !name) return null;
  if (/[\/\\]|\.\.|\0/.test(name)) return null;
  return name;
}

export function backupDirFor(serverId) {
  return path.join(config.backupsDir, serverId);
}

export async function createBackup(manager, serverId, userId, name) {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  const safe = safeBackupName(name);
  const src = path.join(config.serversDir, serverId);
  const dir = backupDirFor(serverId);
  fs.mkdirSync(dir, { recursive: true });
  const id = uid('bkp');
  const fname = `${safe || 'backup'}-${Date.now()}.tar.gz`;
  const out = path.join(dir, fname);
  // exclude cache + backups (--exclude must precede the source path)
  await execFileAsync('tar', ['-czf', out, '--exclude=./cache', '-C', src, '.'], { timeout: 120000 });
  const stat = fs.statSync(out);
  return { id, name: fname, size: stat.size, createdAt: Date.now(), path: fname };
}

export function listBackups(manager, serverId, userId) {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  const dir = backupDirFor(serverId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.tar.gz')).map((f) => {
    const st = fs.statSync(path.join(dir, f));
    return { name: f, size: st.size, createdAt: st.mtimeMs };
  }).sort((a, b) => b.createdAt - a.createdAt);
}

export async function restoreBackup(manager, serverId, userId, backupName) {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  if (!safeBackupName(backupName)) throw new Error('Invalid backup name');
  const src = path.join(config.serversDir, serverId);
  const archive = path.join(backupDirFor(serverId), backupName);
  if (!fs.existsSync(archive)) throw new Error('Backup not found');
  // stop server first
  const inst = manager.servers.get(serverId);
  if (inst) await inst.stop(true).catch(() => {});
  // wipe current world/config but keep nothing; extract over
  await execFileAsync('tar', ['-xzf', archive, '-C', src], { timeout: 120000 });
  return { ok: true };
}

export async function deleteBackup(manager, serverId, userId, backupName) {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  if (!safeBackupName(backupName)) throw new Error('Invalid backup name');
  const archive = path.join(backupDirFor(serverId), backupName);
  if (fs.existsSync(archive)) fs.unlinkSync(archive);
  return { ok: true };
}
