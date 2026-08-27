// WebSocket: live console streaming + control for a server.
import { WebSocketServer } from 'ws';
import { Manager } from '../core/manager.js';

export function attachWebSocket(server, manager) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Broadcaster: push to all clients subscribed to a server.
  const subs = new Map(); // conn -> serverId
  const byServer = new Map(); // serverId -> Set<conn>

  function subscribe(conn, serverId) {
    subs.set(conn, serverId);
    if (!byServer.has(serverId)) byServer.set(serverId, new Set());
    byServer.get(serverId).add(conn);
  }
  function unsubscribe(conn) {
    const sid = subs.get(conn);
    if (sid && byServer.has(sid)) {
      byServer.get(sid).delete(conn);
      if (byServer.get(sid).size === 0) byServer.delete(sid);
    }
    subs.delete(conn);
  }

  // manager emits per-server messages → forward to subscribers
  manager.setBroadcaster((serverId, msg) => {
    const set = byServer.get(serverId);
    if (!set) return;
    const payload = JSON.stringify({ serverId, ...msg });
    for (const conn of set) {
      if (conn.readyState === 1) conn.send(payload);
    }
  });

  wss.on('connection', (conn, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const serverId = url.searchParams.get('serverId');
    const user = token ? manager.sessionFor(token) : null;
    if (!user) { conn.close(4001, 'unauthorized'); return; }
    if (serverId) {
      const srv = manager.getServer(serverId, user.id);
      if (!srv) { conn.close(4004, 'not found'); return; }
      subscribe(conn, serverId);
      // send recent console backlog
      const backlog = manager.getConsole(serverId, user.id, 200);
      conn.send(JSON.stringify({ serverId, type: 'console', backlog }));
      conn.send(JSON.stringify({ serverId, type: 'status', status: srv.status }));
    }

    conn.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
      const sid = subs.get(conn);
      if (!sid) return;
      if (msg.type === 'command') {
        try { manager.sendCommand(sid, user.id, msg.command); }
        catch (e) { conn.send(JSON.stringify({ serverId: sid, type: 'error', message: e.message })); }
      }
    });

    conn.on('close', () => unsubscribe(conn));
    conn.on('error', () => unsubscribe(conn));
  });

  return wss;
}
