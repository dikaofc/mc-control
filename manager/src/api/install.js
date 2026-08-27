// Install a software version into a server (downloads jar / bedrock zip).
import { Manager } from '../core/manager.js';
import { installSoftware, softwareCatalog, listVersions } from '../core/software.js';
import path from 'node:path';
import { config } from '../config.js';

export async function handleInstall(manager, serverId, userId, software, version) {
  const rec = manager.store.find('servers', serverId);
  if (!rec) throw new Error('Server not found');
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) throw new Error('Forbidden');
  const serverDir = path.join(config.serversDir, serverId);
  const result = await installSoftware(software, version, serverDir);
  const patch = { software, version, installed: true };
  if (result.kind === 'jar') patch.jarFile = result.jarFile;
  if (result.kind === 'bedrock') patch.binary = result.binary;
  manager.store.update('servers', serverId, patch);
  return manager.getServer(serverId, userId);
}

