'use client';
import { useEffect, useState } from 'react';
import Nav from '../../components/Nav';
import { api, getToken } from '../../lib/api';

export default function SoftwarePage() {
  const [catalog, setCatalog] = useState([]);
  const [versions, setVersions] = useState({});
  useEffect(() => {
    if (!getToken()) { window.location.href = '/login'; return; }
    api.software().then(setCatalog).catch(() => {});
  }, []);
  async function showVersions(id) {
    try {
      const v = await api.versions(id);
      setVersions((prev) => ({ ...prev, [id]: v.map((x) => x.version || x.id || x) }));
    } catch (e) { setVersions((prev) => ({ ...prev, [id]: ['unavailable'] })); }
  }
  return (
    <div>
      <Nav />
      <div className="container">
        <h1 className="title">Supported Software</h1>
        <p className="subtitle">All major Minecraft server platforms. Versions are fetched live from official sources.</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {catalog.map((s) => (
            <div key={s.id} className="card">
              <div className="row between"><strong>{s.label}</strong><span className="tag">{s.platform}</span></div>
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {s.id === 'vanilla' && 'Official Mojang server — pure survival.'}
                {s.id === 'paper' && 'High-performance Spigot fork, plugin support.'}
                {s.id === 'purpur' && 'Fork of Paper with more config & features.'}
                {s.id === 'fabric' && 'Lightweight mod loader.'}
                {s.id === 'forge' && 'The classic mod loader.'}
                {s.id === 'spigot' && 'Install via BuildTools on the host.'}
                {s.id === 'bedrock' && 'Mojang Bedrock dedicated server (Linux).'}
              </p>
              <button style={{ marginTop: 8 }} onClick={() => showVersions(s.id)}>Show versions</button>
              {versions[s.id] && (
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  {versions[s.id].slice(-12).reverse().join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
