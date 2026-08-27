'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function PortsTab({ id }) {
  const [ports, setPorts] = useState([]);
  const [port, setPort] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setPorts(await api.ports(id)); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [id]);

  async function expose(e) {
    e.preventDefault();
    setError('');
    const p = Number(port);
    if (!p || p < 1 || p > 65535) { setError('Port must be 1-65535'); return; }
    setBusy(true);
    try { await api.exposePort(id, p); setPort(''); load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function unexpose(p) {
    try { await api.unexposePort(id, p); load(); } catch (e) { setError(e.message); }
  }

  const base = (typeof window !== 'undefined') ? window.location.origin : '';
  const urlFor = (p) => `${base}/api/projects/${id}/proxy/${p}`;

  return (
    <div className="card">
      <h2 className="title">Open Port</h2>
      <p className="subtitle">
        Railway exposes only one public port (this panel). To reach an app running in your
        workspace (e.g. <code>node app.js</code> on <code>:3000</code>), expose its port —
        the manager reverse-proxies it through the public URL below. No extra setup.
      </p>

      <form onSubmit={expose} className="row wrap" style={{ gap: 10 }}>
        <input className="flex1 mono" style={{ maxWidth: 200 }}
          value={port} onChange={(e) => setPort(e.target.value)}
          placeholder="local port (e.g. 3000)" inputMode="numeric" />
        <button className="primary" type="submit" disabled={busy}>Expose</button>
      </form>
      {error && <div className="err">{error}</div>}

      <div style={{ marginTop: 16 }}>
        {ports.length === 0 ? (
          <p className="muted">No ports exposed yet. Start your server, then expose its port.</p>
        ) : (
          ports.map((p) => (
            <div key={p} className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div>
                <div className="mono">:{p}</div>
                <a className="mono" href={urlFor(p)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
                  {urlFor(p)}
                </a>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button onClick={() => navigator.clipboard && navigator.clipboard.writeText(urlFor(p))}>Copy</button>
                <button className="danger" onClick={() => unexpose(p)} style={{ padding: '3px 8px' }}>Close</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
