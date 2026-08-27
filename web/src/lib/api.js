// Client-side API wrapper for the VPS control panel manager.
const BASE = process.env.NEXT_PUBLIC_MANAGER_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:8080');

function url(path) {
  if (BASE && BASE.startsWith('http')) return BASE.replace(/\/$/, '') + path;
  return path; // same-origin (combined deploy)
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vps_token');
}
export function setToken(t) {
  if (typeof window !== 'undefined') localStorage.setItem('vps_token', t);
}
export function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem('vps_token');
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

  // projects
  projects: () => request('GET', '/api/projects'),
  getProject: (id) => request('GET', `/api/projects/${id}`),
  createProject: (body) => request('POST', '/api/projects', body),
  renameProject: (id, name) => request('PATCH', `/api/projects/${id}`, { name }),
  deleteProject: (id) => request('DELETE', `/api/projects/${id}`),

  // files
  files: (id, path) => request('GET', `/api/projects/${id}/files?path=${encodeURIComponent(path || '')}`),
  readFile: (id, path) => request('GET', `/api/projects/${id}/files/read?path=${encodeURIComponent(path)}`),
  writeFile: (id, path, content) => request('POST', `/api/projects/${id}/files/write`, { path, content }),
  createPath: (id, path, isDir) => request('POST', `/api/projects/${id}/files/create`, { path, isDir }),
  deletePath: (id, path) => request('DELETE', `/api/projects/${id}/files?path=${encodeURIComponent(path)}`),
  renamePath: (id, from, to) => request('POST', `/api/projects/${id}/files/rename`, { from, to }),

  // processes
  processes: (id) => request('GET', `/api/projects/${id}/processes`),
  runProcess: (id, command) => request('POST', `/api/projects/${id}/processes`, { command }),
  stopProcess: (id, pid) => request('DELETE', `/api/projects/${id}/processes/${pid}`),

  // system
  system: () => request('GET', '/api/system'),
};

// Terminal (PTY) WebSocket.
export function terminalSocket(projectId, onMessage) {
  const token = getToken();
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  let host;
  if (BASE && BASE.startsWith('http')) {
    const u = new URL(BASE);
    host = (proto === 'wss' ? 'wss' : 'ws') + '://' + u.host;
  } else {
    host = proto + '://' + window.location.host;
  }
  const ws = new WebSocket(`${host}/ws?mode=terminal&projectId=${projectId || ''}&token=${token}`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  return ws;
}

// Process-output WebSocket (streams output of background runs).
export function processSocket(projectId, onMessage) {
  const token = getToken();
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  let host;
  if (BASE && BASE.startsWith('http')) {
    const u = new URL(BASE);
    host = (proto === 'wss' ? 'wss' : 'ws') + '://' + u.host;
  } else {
    host = proto + '://' + window.location.host;
  }
  const ws = new WebSocket(`${host}/ws?projectId=${projectId}&token=${token}`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  return ws;
}
