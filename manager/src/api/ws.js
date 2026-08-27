// WebSocket: live PTY terminal + process output streaming for a project.
import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';
import { Manager } from '../core/manager.js';
import { attachTerminal } from '../core/terminal.js';

// Short-lived WebSocket tokens (5 min expiry) to avoid session token in URL logs.
const wsTokens = new Map(); // token -> { userId, expiresAt }

export function createWsToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  wsTokens.set(token, { userId, expiresAt: Date.now() + 5 * 60 * 1000 });
  // Cleanup old tokens periodically
  if (wsTokens.size > 1000) {
    for (const [k, v] of wsTokens) { if (v.expiresAt < Date.now()) wsTokens.delete(k); }
  }
  return token;
}

export function attachWebSocket(server, manager) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const subs = new Map();      // conn -> projectId
  const byProject = new Map(); // projectId -> Set<conn>
  const connCount = new Map(); // userId -> count
  const MAX_WS_PER_USER = 5;
  const MAX_WS_GLOBAL = 50;

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
    const userId = conn._userId;
    if (userId && connCount.has(userId)) {
      const c = connCount.get(userId) - 1;
      if (c <= 0) connCount.delete(userId); else connCount.set(userId, c);
    }
    subs.delete(conn);
  }

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
    const mode = url.searchParams.get('mode');

    // Auth: try wsTokens first, then session tokens.
    let user = null;
    if (token && wsTokens.has(token)) {
      const wsTok = wsTokens.get(token);
      if (wsTok.expiresAt > Date.now()) {
        user = manager.findUserById(wsTok.userId);
      }
      wsTokens.delete(token); // one-time use
    }
    if (!user) {
      user = token ? manager.sessionFor(token) : null;
    }
    if (!user) { conn.close(4001, 'unauthorized'); return; }

    // Connection limits.
    const userConns = connCount.get(user.id) || 0;
    if (userConns >= MAX_WS_PER_USER) {
      conn.close(4029, 'too many connections');
      return;
    }
    const totalConns = subs.size + 1; // approx
    if (totalConns > MAX_WS_GLOBAL) {
      conn.close(4029, 'server full');
      return;
    }
    connCount.set(user.id, userConns + 1);
    conn._userId = user.id;

    if (mode === 'terminal') {
      if (projectId) {
        const proj = manager.getProject(projectId, user.id);
        if (!proj) { conn.close(4004, 'not found'); return; }
      }
      attachTerminal(conn, manager, user, projectId);
      return;
    }

    // Subscribe to process output.
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
