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

// Minecraft usernames are [a-zA-Z0-9_], max 16 chars. Strip anything else so a
// crafted name can't inject console commands (e.g. "x; stop").
function safeName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
}

function safeReason(reason) {
  if (typeof reason !== 'string') return 'Banned by admin';
  return reason.replace(/\r?\n/g, ' ').slice(0, 100);
}

export function getOps(manager, serverId, userId) {
  return readJson(jsonFile(manager, serverId, userId, 'ops.json'), []);
}
export function addOp(manager, serverId, userId, name) {
  const safe = safeName(name);
  if (!safe) throw new Error('Invalid player name');
  const f = jsonFile(manager, serverId, userId, 'ops.json');
  const ops = readJson(f, []);
  if (!ops.find((o) => o.name === safe)) ops.push({ uuid: '', name: safe, level: 4, bypassesPlayerLimit: false });
  writeJson(f, ops);
  cmd(manager, serverId, `op ${safe}`);
  return ops;
}
export function removeOp(manager, serverId, userId, name) {
  const safe = safeName(name);
  const f = jsonFile(manager, serverId, userId, 'ops.json');
  const ops = readJson(f, []).filter((o) => o.name !== safe);
  writeJson(f, ops);
  cmd(manager, serverId, `deop ${safe}`);
  return ops;
}

export function getWhitelist(manager, serverId, userId) {
  return readJson(jsonFile(manager, serverId, userId, 'whitelist.json'), []);
}
export function addWhitelist(manager, serverId, userId, name) {
  const safe = safeName(name);
  if (!safe) throw new Error('Invalid player name');
  const f = jsonFile(manager, serverId, userId, 'whitelist.json');
  const list = readJson(f, []);
  if (!list.find((w) => w.name === safe)) list.push({ uuid: '', name: safe });
  writeJson(f, list);
  cmd(manager, serverId, `whitelist add ${safe}`);
  return list;
}
export function removeWhitelist(manager, serverId, userId, name) {
  const safe = safeName(name);
  const f = jsonFile(manager, serverId, userId, 'whitelist.json');
  const list = readJson(f, []).filter((w) => w.name !== safe);
  writeJson(f, list);
  cmd(manager, serverId, `whitelist remove ${safe}`);
  return list;
}

export function getBans(manager, serverId, userId) {
  return readJson(jsonFile(manager, serverId, userId, 'banned-players.json'), []);
}
export function banPlayer(manager, serverId, userId, name, reason = 'Banned by admin') {
  const safe = safeName(name);
  if (!safe) throw new Error('Invalid player name');
  cmd(manager, serverId, `ban ${safe} ${safeReason(reason)}`);
  return { ok: true };
}
export function unbanPlayer(manager, serverId, userId, name) {
  const safe = safeName(name);
  cmd(manager, serverId, `pardon ${safe}`);
  return { ok: true };
}
