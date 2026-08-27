// Central configuration. Reads from env so it runs locally and as a VPS service.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const config = {
  root: ROOT,
  dataDir: process.env.MC_DATA_DIR || path.join(ROOT, 'data'),
  projectsDir: process.env.MC_PROJECTS_DIR || path.join(ROOT, 'data', 'projects'),

  port: Number(process.env.PORT || 8080),
  host: process.env.HOST || '0.0.0.0',
  // Secret used to sign session tokens. Set in production.
  sessionSecret: process.env.MC_SESSION_SECRET || 'dev-insecure-secret-change-me',
  sessionTtlMs: Number(process.env.MC_SESSION_TTL || 7 * 24 * 3600 * 1000),
};

// Ensure directories exist.
import fs from 'node:fs';
for (const d of [config.dataDir, config.projectsDir]) {
  fs.mkdirSync(d, { recursive: true });
}
