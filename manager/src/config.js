// Central configuration. Reads from env so it runs locally and as a VPS service.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const config = {
  root: ROOT,
  dataDir: process.env.MC_DATA_DIR || path.join(ROOT, 'data'),
  serversDir: process.env.MC_SERVERS_DIR || path.join(ROOT, 'data', 'servers'),
  cacheDir: process.env.MC_CACHE_DIR || path.join(ROOT, 'data', 'cache'),
  backupsDir: process.env.MC_BACKUPS_DIR || path.join(ROOT, 'data', 'backups'),

  port: Number(process.env.PORT || 8080),
  host: process.env.HOST || '0.0.0.0',
  // Secret used to sign session tokens. MUST be overridden in production.
  sessionSecret: process.env.MC_SESSION_SECRET || 'dev-insecure-secret-change-me',
  sessionTtlMs: Number(process.env.MC_SESSION_TTL || 7 * 24 * 3600 * 1000),

  // Defaults a freshly created server inherits.
  javaBin: process.env.JAVA_BIN || 'java',
  defaultMemoryMb: Number(process.env.MC_DEFAULT_MEM || 1024),
  maxMemoryMb: Number(process.env.MC_MAX_MEM || 4096),
  defaultPort: 25565,

  // Allowed network bind interface for servers (0.0.0.0 = all).
  serverBindHost: process.env.MC_BIND_HOST || '0.0.0.0',
};

// Ensure directories exist.
import fs from 'node:fs';
for (const d of [config.dataDir, config.serversDir, config.cacheDir, config.backupsDir]) {
  fs.mkdirSync(d, { recursive: true });
}
