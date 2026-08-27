// PTY terminal service: spawns a real shell in a workspace and streams it
// over a WebSocket. Uses node-pty for a full interactive TTY (vim/htop work).
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
export async function attachTerminal(conn, manager, user, projectId) {
  let pty;
  try {
    // Lazy-load: if the native binding fails, the rest of the control plane
    // (file manager, process runner, API) keeps working instead of crashing.
    pty = (await import('node-pty')).default;
  } catch (err) {
    if (conn.readyState === 1) conn.send(JSON.stringify({ type: 'data', data: `\r\n\x1b[31m[Terminal unavailable: node-pty failed to load: ${err.message}]\x1b[0m\r\n` }));
    conn.on('message', () => {});
    return null;
  }

  const cwd = (projectId && workspaceDir(manager, projectId, user.id)) || config.projectsDir;
  const env = { ...process.env, TERM: 'xterm-256color', HOME: process.env.HOME || '/data', USER: user.username };
  // Never expose the panel signing secret or Railway creds to the shell.
  delete env.MC_SESSION_SECRET;
  for (const k of Object.keys(env)) if (/railway/i.test(k)) delete env[k];
  const term = pty.spawn(shellPath(), [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd,
    env,
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
