'use client';
import { useEffect, useRef, useState } from 'react';
import { api, processSocket } from '../lib/api';

export default function ProcessesTab({ id }) {
  const [procs, setProcs] = useState([]);
  const [cmd, setCmd] = useState('');
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);
  const wsRef = useRef(null);

  async function load() {
    try { setProcs(await api.processes(id)); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    let ws;
    (async () => {
      ws = await processSocket(id, (msg) => {
        if (msg.type === 'process' || msg.type === 'process-exit') {
          setLog((prev) => [...prev.slice(-500), `[${msg.type}] ${msg.line || JSON.stringify(msg)}`]);
          if (msg.type === 'process-exit') load();
        }
      });
      wsRef.current = ws;
    })();
    return () => { try { ws && ws.close(); } catch {} };
  }, [id]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [log]);

  async function run() {
    if (!cmd.trim()) return;
    setError('');
    setBusy(true);
    try { await api.runProcess(id, cmd); setLog((p) => [...p, `$ ${cmd}`]); load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function stop(pid) {
    try { await api.stopProcess(id, pid); load(); } catch (e) { setError(e.message); }
  }

  const quickCmds = [
    { label: 'Node.js', cmd: "node -e \"console.log('Hello from Node.js!')\"", icon: '🟢' },
    { label: 'Python', cmd: "python3 -c \"print('Hello from Python!')\"", icon: '🐍' },
    { label: 'System', cmd: 'uname -a && cat /etc/os-release', icon: '🐧' },
    { label: 'Disk', cmd: 'df -h', icon: '💾' },
    { label: 'Top', cmd: 'ps aux --sort=-%mem | head -20', icon: '📊' },
    { label: 'Network', cmd: 'ip addr show || ifconfig', icon: '🌐' },
  ];

  return (
    <div>
      <div className="card">
        <h2 className="title" style={{ fontSize: 17 }}>Run Command</h2>
        <p className="subtitle">Run anything on this VPS. Output streams live.</p>
        <div className="row-mobile">
          <input className="flex1 mono" value={cmd} onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="node app.js, python main.py, ..." />
          <button className="primary" onClick={run} disabled={busy}>Run</button>
        </div>
        {error && <div className="err">{error}</div>}

        <div style={{ marginTop: 14 }}>
          <p className="muted" style={{ fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Quick commands</p>
          <div className="row-mobile" style={{ gap: 6 }}>
            {quickCmds.map((q) => (
              <button key={q.label} onClick={() => setCmd(q.cmd)}
                style={{ padding: '5px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                {q.icon} {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 className="title" style={{ fontSize: 15 }}>Running Processes</h3>
        {procs.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 20 }}>No running processes</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead><tr><th>PID</th><th>Command</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {procs.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.pid}</td>
                    <td className="mono">{p.cmd}</td>
                    <td><span className={`dot ${p.status === 'running' ? 'online' : 'offline'}`} /> {p.status}</td>
                    <td><button className="danger" onClick={() => stop(p.id)} style={{ padding: '4px 10px', fontSize: 12 }}>Stop</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3 className="title" style={{ fontSize: 15 }}>Output</h3>
        <div className="console" ref={boxRef}>
          {log.length === 0 ? <span className="muted">No output yet. Run a command to see its stream.</span> :
            log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}
