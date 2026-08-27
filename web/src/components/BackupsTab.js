'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function BackupsTab({ id }) {
  const [backups, setBackups] = useState([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setBackups(await api.backups(id)); } catch (e) { setMsg(e.message); }
  }
  useEffect(() => { load(); }, [id]);

  async function create() {
    setBusy(true); setMsg('Creating backup (tar)…');
    try { await api.createBackup(id, name || undefined); setName(''); setMsg('Backup created.'); load(); }
    catch (e) { setMsg('Error: ' + e.message); }
    finally { setBusy(false); }
  }
  async function restore(b) {
    if (!confirm('Restore ' + b + '? This overwrites current files (server will stop).')) return;
    setMsg('Restoring…');
    try { await api.restoreBackup(id, b); setMsg('Restored.'); } catch (e) { setMsg('Error: ' + e.message); }
  }
  async function del(b) {
    if (!confirm('Delete backup ' + b + '?')) return;
    try { await api.deleteBackup(id, b); load(); } catch (e) { setMsg(e.message); }
  }

  return (
    <div className="card">
      <h2 className="title">Backups</h2>
      <p className="subtitle">Full server directory snapshots (tar.gz). Stored on the manager host.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <input className="flex1" value={name} onChange={(e) => setName(e.target.value)} placeholder="backup label (optional)" />
        <button className="primary" onClick={create} disabled={busy}>{busy ? 'Working…' : 'Create Backup'}</button>
      </div>
      {msg && <div className={msg.startsWith('Error') ? 'err' : 'ok'}>{msg}</div>}
      <table className="table">
        <thead><tr><th>Name</th><th>Size</th><th>Created</th><th style={{ width: 200 }}>Actions</th></tr></thead>
        <tbody>
          {backups.map((b) => (
            <tr key={b.name}>
              <td>{b.name}</td>
              <td className="muted">{(b.size / 1048576).toFixed(1)} MB</td>
              <td className="muted">{new Date(b.createdAt).toLocaleString()}</td>
              <td>
                <button className="blue" onClick={() => restore(b.name)} style={{ padding: '3px 8px' }}>Restore</button>
                <button className="danger" onClick={() => del(b.name)} style={{ padding: '3px 8px', marginLeft: 6 }}>Delete</button>
              </td>
            </tr>
          ))}
          {backups.length === 0 && <tr><td className="muted" colSpan={4}>No backups yet</td></tr></tbody>}
        </table>
    </div>
  );
}
