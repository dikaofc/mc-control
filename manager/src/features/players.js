// Player management: ops, whitelist, bans. Edits the JSON files used by the server.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

function jsonFile(manager, serverId, userId, filename) {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  return path.join(config.serversDir, serverId, filename);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function cmd(manager, serverId, command) {
  const inst = manager.servers.get(serverId);
  if (inst) { try { inst.sendCommand(command); } catch {} }
}

export function getOps(manager, serverId, userId) {
  return readJson(jsonFile(manager, serverId, userId, 'ops.json'), []);
}
export function addOp(manager, serverId, userId, name) {
  const f = jsonFile(manager, serverId, userId, 'ops.json');
  const ops = readJson(f, []);
  if (!ops.find((o) => o.name === name)) ops.push({ uuid: '', name, level: 4, bypassesPlayerLimit: false });
  writeJson(f, ops);
  cmd(manager, serverId, `op ${name}`);
  return ops;
}
export function removeOp(manager, serverId, userId, name) {
  const f = jsonFile(manager, serverId, userId, 'ops.json');
  const ops = readJson(f, []).filter((o) => o.name !== name);
  writeJson(f, ops);
  cmd(manager, serverId, `deop ${name}`);
  return ops;
}

export function getWhitelist(manager, serverId, userId) {
  return readJson(jsonFile(manager, serverId, userId, 'whitelist.json'), []);
}
export function addWhitelist(manager, serverId, userId, name) {
  const f = jsonFile(manager, serverId, userId, 'whitelist.json');
  const list = readJson(f, []);
  if (!list.find((w) => w.name === name)) list.push({ uuid: '', name });
  writeJson(f, list);
  cmd(manager, serverId, `whitelist add ${name}`);
  return list;
}
export function removeWhitelist(manager, serverId, userId, name) {
  const f = jsonFile(manager, serverId, userId, 'whitelist.json');
  const list = readJson(f, []).filter((w) => w.name !== name);
  writeJson(f, list);
  cmd(manager, serverId, `whitelist remove ${name}`);
  return list;
}

export function getBans(manager, serverId, userId) {
  return readJson(jsonFile(manager, serverId, userId, 'banned-players.json'), []);
}
export function banPlayer(manager, serverId, userId, name, reason = 'Banned by admin') {
  cmd(manager, serverId, `ban ${name} ${reason}`);
  return { ok: true };
}
export function unbanPlayer(manager, serverId, userId, name) {
  cmd(manager, serverId, `pardon ${name}`);
  return { ok: true };
}
