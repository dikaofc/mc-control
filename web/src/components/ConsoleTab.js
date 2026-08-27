'use client';
import { useEffect, useRef, useState } from 'react';
import { api, consoleSocket } from '../lib/api';

export default function ConsoleTab({ id, server }) {
  const [lines, setLines] = useState([]);
  const [cmd, setCmd] = useState('');
  const [wsStatus, setWsStatus] = useState('connecting');
  const boxRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    // load backlog
    api.console(id, 500).then((d) => setLines(d.lines || [])).catch(() => {});
    let ws;
    try {
      ws = consoleSocket(id, (msg) => {
        if (msg.type === 'console') {
          if (msg.backlog) setLines((prev) => [...prev, ...msg.backlog]);
          else setLines((prev) => [...prev.slice(-1500), msg.line]);
        } else if (msg.type === 'status') {
          setWsStatus(msg.status);
        }
      });
      ws.onopen = () => setWsStatus('live');
      ws.onclose = () => setWsStatus('closed');
      wsRef.current = ws;
    } catch (e) {
      setWsStatus('error');
    }
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [id]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines]);

  async function send() {
    if (!cmd.trim()) return;
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
    } else {
      try { await api.command(id, cmd); } catch (e) {}
    }
    setCmd('');
  }

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <strong>Live Console</strong>
        <span className="muted" style={{ fontSize: 12 }}>ws: {wsStatus}</span>
      </div>
      <div className="console" ref={boxRef}>
        {lines.length === 0 ? <span className="muted">No output yet. Start the server to see the console.</span> :
          lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <input className="flex1 mono" value={cmd} onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a command (e.g. op Steve, gamemode creative)" />
        <button className="blue" onClick={send}>Send</button>
      </div>
    </div>
  );
}
