'use client';
import { useState } from 'react';
import { api } from '../lib/api';

export default function AddonsTab({ id, server }) {
  const isMod = server.platform === 'forge' || server.software === 'fabric';
  const type = isMod ? 'mod' : 'plugin';
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState([]);

  async function search() {
    setMsg('');
    try {
      const r = await api.searchAddons(q || 'essentials', type, server.version);
      setResults(r || []);
    } catch (e) { setMsg('Search failed: ' + e.message); setResults([]); }
  }
  async function install(projectId, title) {
    setBusy(true); setMsg('Installing ' + title + '…');
    try {
      await api.installAddon(id, projectId, type);
      setInstalled([...installed, title]);
      setMsg('Installed ' + title + '. Restart the server to load it.');
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card">
      <h2 className="title">Plugins / Mods</h2>
      <p className="subtitle">
        Browse Modrinth. This server uses <strong>{type}s</strong> ({server.software}).
      </p>
      <div className="row" style={{ marginBottom: 14 }}>
        <input className="flex1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Modrinth (e.g. Essentials, LuckPerms, WorldEdit)" />
        <button className="blue" onClick={search}>Search</button>
      </div>
      {msg && <div className={msg.startsWith('Error') ? 'err' : 'ok'}>{msg}</div>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {results.map((r) => (
          <div key={r.id} className="card" style={{ padding: 14 }}>
            <strong>{r.title}</strong>
            <p className="muted" style={{ fontSize: 12, margin: '6px 0' }}>{r.description?.slice(0, 90)}</p>
            <div className="row between">
              <span className="tag">⬇ {r.downloads?.toLocaleString?.() || r.downloads || '?'}</span>
              <button className="primary" onClick={() => install(r.id, r.title)} disabled={busy || installed.includes(r.title)}>
                {installed.includes(r.title) ? 'Added' : 'Install'}
              </button>
            </div>
          </div>
        ))}
        {results.length === 0 && <p className="muted">Search to find {type}s.</p>}
      </div>
    </div>
  );
}
