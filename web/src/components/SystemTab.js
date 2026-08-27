'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

export default function SystemTab() {
  const [sys, setSys] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    try { setSys(await api.system()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { const iv = setInterval(load, 5000); return () => clearInterval(iv); }, []);

  if (loading) return <div className="card" style={{ textAlign: 'center', padding: 30 }}><p className="muted">Loading system info...</p></div>;
  if (error) return <div className="err">{error}</div>;
  if (!sys) return null;

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      <div className="card">
        <h3 className="title" style={{ fontSize: 15 }}>System</h3>
        <table className="table">
          <tbody>
            <tr><td className="muted">Hostname</td><td className="mono">{sys.hostname}</td></tr>
            <tr><td className="muted">Platform</td><td className="mono">{sys.platform} {sys.arch}</td></tr>
            <tr><td className="muted">OS</td><td className="mono" style={{ fontSize: 11 }}>{sys.osInfo}</td></tr>
            <tr><td className="muted">Uptime</td><td className="mono">{sys.uptime}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="title" style={{ fontSize: 15 }}>CPU</h3>
        <table className="table">
          <tbody>
            <tr><td className="muted">Model</td><td className="mono" style={{ fontSize: 11 }}>{sys.cpu.model}</td></tr>
            <tr><td className="muted">Cores</td><td className="mono">{sys.cpu.cores}</td></tr>
            <tr><td className="muted">Speed</td><td className="mono">{sys.cpu.speed} MHz</td></tr>
            <tr><td className="muted">Load</td><td className="mono">{sys.loadAvg?.map(l => l.toFixed(2)).join(' / ')}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="title" style={{ fontSize: 15 }}>Memory</h3>
        <div style={{ marginBottom: 12 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Usage</span>
            <span className="mono" style={{ fontWeight: 700, color: sys.memory.percent > 80 ? 'var(--red)' : 'var(--green)' }}>{sys.memory.percent}%</span>
          </div>
          <div className="progress"><div style={{ width: sys.memory.percent + '%' }} /></div>
        </div>
        <table className="table">
          <tbody>
            <tr><td className="muted">Total</td><td className="mono">{formatBytes(sys.memory.total)}</td></tr>
            <tr><td className="muted">Used</td><td className="mono">{formatBytes(sys.memory.used)}</td></tr>
            <tr><td className="muted">Free</td><td className="mono">{formatBytes(sys.memory.free)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="title" style={{ fontSize: 15 }}>Disk</h3>
        <div style={{ marginBottom: 12 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Usage</span>
            <span className="mono" style={{ fontWeight: 700 }}>{sys.disk.total ? Math.round((sys.disk.used / sys.disk.total) * 100) : 0}%</span>
          </div>
          <div className="progress"><div style={{ width: (sys.disk.total ? (sys.disk.used / sys.disk.total) * 100 : 0) + '%' }} /></div>
        </div>
        <table className="table">
          <tbody>
            <tr><td className="muted">Total</td><td className="mono">{formatBytes(sys.disk.total)}</td></tr>
            <tr><td className="muted">Used</td><td className="mono">{formatBytes(sys.disk.used)}</td></tr>
            <tr><td className="muted">Free</td><td className="mono">{formatBytes(sys.disk.free)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h3 className="title" style={{ fontSize: 15 }}>Runtimes</h3>
        <div className="row wrap" style={{ gap: 10, marginTop: 4 }}>
          {sys.runtimes.node && (
            <div className="pill"><span className="dot online" /> Node.js {sys.runtimes.node}</div>
          )}
          {sys.runtimes.python && (
            <div className="pill"><span className="dot online" /> {sys.runtimes.python}</div>
          )}
          <div className="pill"><span className="dot online" /> Bash</div>
          <div className="pill"><span className="dot online" /> Git</div>
        </div>
      </div>
    </div>
  );
}
