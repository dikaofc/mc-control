// PTY terminal service: spawns a real shell in a workspace and streams it
// over a WebSocket. Uses node-pty for a full interactive TTY (vim/htop work).
import pty from 'node-pty';
import path from 'node:path';
import { config } from '../config.js';
import { Manager } from './manager.js';

function shellPath() {
  if (process.platform === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/bash';
}

function workspaceDir(manager, projectId, userId) {
  const rec = manager.store.find('projects', projectId);
  if (!rec) return null;
  if (rec.ownerId !== userId && !manager._isAdmin(userId)) return null;
  return path.join(config.projectsDir, projectId);
}

// Attach a terminal session to a WebSocket connection.
// conn: ws connection; msg handlers: { type:'data', data } in, { type:'resize', cols, rows } in.
export function attachTerminal(conn, manager, user, projectId) {
  const cwd = (projectId && workspaceDir(manager, projectId, user.id)) || config.projectsDir;
  const term = pty.spawn(shellPath(), [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd,
    env: { ...process.env, TERM: 'xterm-256color', HOME: process.env.HOME || '/root', USER: user.username },
  });

  term.onData((data) => {
    if (conn.readyState === 1) conn.send(JSON.stringify({ type: 'data', data }));
  });
  term.onExit(() => {
    if (conn.readyState === 1) conn.send(JSON.stringify({ type: 'exit' }));
    try { conn.close(); } catch {}
  });

  conn.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === 'data' && typeof msg.data === 'string') {
      term.write(msg.data);
    } else if (msg.type === 'resize') {
      try { term.resize(Number(msg.cols) || 80, Number(msg.rows) || 24); } catch {}
    }
  });
  conn.on('close', () => { try { term.kill(); } catch {} });

  return term;
}
