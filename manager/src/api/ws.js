// WebSocket: live PTY terminal + process output streaming for a project.
import { WebSocketServer } from 'ws';
import { Manager } from '../core/manager.js';
import { attachTerminal } from '../core/terminal.js';

export function attachWebSocket(server, manager) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const subs = new Map();      // conn -> projectId
  const byProject = new Map(); // projectId -> Set<conn>

  function subscribe(conn, projectId) {
    subs.set(conn, projectId);
    if (!byProject.has(projectId)) byProject.set(projectId, new Set());
    byProject.get(projectId).add(conn);
  }
  function unsubscribe(conn) {
    const pid = subs.get(conn);
    if (pid && byProject.has(pid)) {
      byProject.get(pid).delete(conn);
      if (byProject.get(pid).size === 0) byProject.delete(pid);
    }
    subs.delete(conn);
  }

  // manager emits per-project process output -> forward to subscribers
  manager.setBroadcaster((projectId, msg) => {
    const set = byProject.get(projectId);
    if (!set) return;
    const payload = JSON.stringify({ projectId, ...msg });
    for (const conn of set) if (conn.readyState === 1) conn.send(payload);
  });

  wss.on('connection', (conn, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const projectId = url.searchParams.get('projectId');
    const mode = url.searchParams.get('mode'); // 'terminal' | 'process'
    const user = token ? manager.sessionFor(token) : null;
    if (!user) { conn.close(4001, 'unauthorized'); return; }

    if (mode === 'terminal') {
      if (projectId) {
        const proj = manager.getProject(projectId, user.id);
        if (!proj) { conn.close(4004, 'not found'); return; }
      }
      attachTerminal(conn, manager, user, projectId);
      return;
    }

    // default mode: subscribe to process output for a project
    if (projectId) {
      const proj = manager.getProject(projectId, user.id);
      if (!proj) { conn.close(4004, 'not found'); return; }
      subscribe(conn, projectId);
    }
    conn.on('message', () => {});
    conn.on('close', () => unsubscribe(conn));
    conn.on('error', () => unsubscribe(conn));
  });

  return wss;
}
