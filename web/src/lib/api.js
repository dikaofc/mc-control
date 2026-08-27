// Client-side API wrapper. Talks to the manager API (NEXT_PUBLIC_MANAGER_URL).
const BASE = process.env.NEXT_PUBLIC_MANAGER_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:8080');

function url(path) {
  if (BASE && BASE.startsWith('http')) return BASE.replace(/\/$/, '') + path;
  return path; // same-origin (rewrite or dev proxy)
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mc_token');
}
export function setToken(t) {
  if (typeof window !== 'undefined') localStorage.setItem('mc_token', t);
}
export function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem('mc_token');
}

async function request(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (auth && token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(url(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

export const api = {
  login: (username, password) => request('POST', '/api/auth/login', { username, password }, false),
  register: (username, password) => request('POST', '/api/auth/register', { username, password }, false),
  me: () => request('GET', '/api/auth/me'),
  software: () => request('GET', '/api/software'),
  versions: (software) => request('GET', `/api/software/${software}/versions`),
  servers: () => request('GET', '/api/servers'),
  getServer: (id) => request('GET', `/api/servers/${id}`),
  createServer: (body) => request('POST', '/api/servers', body),
  updateServer: (id, body) => request('PATCH', `/api/servers/${id}`, body),
  deleteServer: (id) => request('DELETE', `/api/servers/${id}`),
  install: (id, software, version) => request('POST', `/api/servers/${id}/install`, { software, version }),
  start: (id) => request('POST', `/api/servers/${id}/start`, {}),
  stop: (id, force) => request('POST', `/api/servers/${id}/stop`, { force }),
  restart: (id) => request('POST', `/api/servers/${id}/restart`, {}),
  command: (id, command) => request('POST', `/api/servers/${id}/command`, { command }),
  console: (id, tail) => request('GET', `/api/servers/${id}/console?tail=${tail || 500}`),
  files: (id, path) => request('GET', `/api/servers/${id}/files?path=${encodeURIComponent(path || '')}`),
  readFile: (id, path) => request('GET', `/api/servers/${id}/files/read?path=${encodeURIComponent(path)}`),
  writeFile: (id, path, content) => request('POST', `/api/servers/${id}/files/write`, { path, content }),
  createPath: (id, path, isDir) => request('POST', `/api/servers/${id}/files/create`, { path, isDir }),
  deletePath: (id, path) => request('DELETE', `/api/servers/${id}/files?path=${encodeURIComponent(path)}`),
  backups: (id) => request('GET', `/api/servers/${id}/backups`),
  createBackup: (id, name) => request('POST', `/api/servers/${id}/backups`, { name }),
  restoreBackup: (id, name) => request('POST', `/api/servers/${id}/backups/restore`, { name }),
  deleteBackup: (id, name) => request('DELETE', `/api/servers/${id}/backups`, { name }),
  ops: (id) => request('GET', `/api/servers/${id}/players/ops`),
  addOp: (id, name) => request('POST', `/api/servers/${id}/players/ops`, { name }),
  removeOp: (id, name) => request('DELETE', `/api/servers/${id}/players/ops`, { name }),
  whitelist: (id) => request('GET', `/api/servers/${id}/players/whitelist`),
  addWhitelist: (id, name) => request('POST', `/api/servers/${id}/players/whitelist`, { name }),
  removeWhitelist: (id, name) => request('DELETE', `/api/servers/${id}/players/whitelist`, { name }),
  bans: (id) => request('GET', `/api/servers/${id}/players/bans`),
  ban: (id, name, reason) => request('POST', `/api/servers/${id}/players/ban`, { name, reason }),
  unban: (id, name) => request('POST', `/api/servers/${id}/players/unban`, { name }),
  searchAddons: (q, type, mc) => request('GET', `/api/addons/search?q=${encodeURIComponent(q)}&type=${type}&mc=${mc || ''}`),
  installAddon: (id, projectId, type) => request('POST', `/api/servers/${id}/addons`, { projectId, type }),
  schedule: (id) => request('GET', `/api/servers/${id}/schedule`),
  addTask: (id, body) => request('POST', `/api/servers/${id}/schedule`, body),
  updateTask: (id, taskId, body) => request('PATCH', `/api/servers/${id}/schedule/${taskId}`, body),
  removeTask: (id, taskId) => request('DELETE', `/api/servers/${id}/schedule/${taskId}`),
};

// WebSocket console connection helper.
export function consoleSocket(serverId, onMessage) {
  const token = getToken();
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  let host;
  if (BASE && BASE.startsWith('http')) {
    const u = new URL(BASE);
    host = (proto === 'wss' ? 'wss' : 'ws') + '://' + u.host;
  } else {
    host = proto + '://' + window.location.host;
  }
  const ws = new WebSocket(`${host}/ws?serverId=${serverId}&token=${token}`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  return ws;
}
