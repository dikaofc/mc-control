// Plugins (Bukkit/Spigot/Paper/Purpur) and Mods (Fabric/Forge) via Modrinth API.
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'mc-control-manager' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGetJson(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function httpDownload(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'mc-control-manager' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fs.unlink(dest, () => {});
        return httpDownload(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { fs.unlink(dest, () => {}); return reject(new Error('dl ' + res.statusCode)); }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    }).on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
  });
}

// Search Modrinth for plugins/mods. project_type: 'plugin' or 'mod'.
export async function searchAddons(query, type = 'plugin', mcVersion = null, limit = 20) {
  let url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=[["project_type:${type}"]]`;
  if (mcVersion) url += `,["versions:${mcVersion}"]`;
  url += `&limit=${limit}`;
  const data = await httpGetJson(url);
  return (data.hits || []).map((h) => ({
    id: h.project_id, slug: h.slug, title: h.title, description: h.description,
    downloads: h.downloads, icon: h.icon_url, version: h.latest_version,
  }));
}

export async function installAddon(manager, serverId, userId, projectId, type = 'plugin') {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  const project = await httpGetJson(`https://api.modrinth.com/v2/project/${projectId}/version`);
  if (!project.length) throw new Error('No versions found');
  // pick latest version compatible with server version
  const target = project.find((v) => !rec.version || (v.game_versions || []).includes(rec.version)) || project[0];
  const file = target.files.find((f) => f.primary) || target.files[0];
  const folder = type === 'mod' ? 'mods' : 'plugins';
  const destDir = path.join(config.serversDir, serverId, folder);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, file.filename);
  await httpDownload(file.url, dest);
  return { id: projectId, file: file.filename, installed: true };
}
