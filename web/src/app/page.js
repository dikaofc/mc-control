'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../components/Nav';
import { api, getToken } from '../lib/api';

export default function Home() {
  const router = useRouter();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', platform: 'java', software: 'vanilla', version: '', port: 25565,
    memoryMb: 1024, maxPlayers: 20, acceptEula: false,
  });
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    load();
  }, []);

  async function load() {
    try { setServers(await api.servers()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function onPlatformOrSoftwareChange(next) {
    setForm(next);
    if (next.software) {
      try {
        const vs = await api.versions(next.software);
        setVersions(vs.map((v) => v.version || v.id || v));
      } catch { setVersions([]); }
    }
  }

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createServer(form);
      setShowCreate(false);
      setForm({ ...form, name: '', version: '' });
      load();
    } catch (err) { setError(err.message); }
  }

  // Refresh statuses every 5s
  useEffect(() => {
    const t = setInterval(() => { if (!showCreate) load(); }, 5000);
    return () => clearInterval(t);
  }, [showCreate]);

  return (
    <div>
      <Nav />
      <div className="container">
        <div className="row between" style={{ marginBottom: 18 }}>
          <div>
            <h1 className="title">Your Servers</h1>
            <p className="subtitle">Manage Minecraft Java & Bedrock servers. Click a server to open the control panel.</p>
          </div>
          <button className="primary" onClick={() => setShowCreate(true)}>+ Create Server</button>
        </div>

        {error && <div className="err">{error}</div>}

        {loading ? <p className="muted">Loading…</p> :
          servers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p className="muted">No servers yet. Create your first one.</p>
              <button className="primary" onClick={() => setShowCreate(true)}>+ Create Server</button>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {servers.map((s) => (
                <div key={s.id} className="card" style={{ cursor: 'pointer' }} onClick={() => router.push(`/server/${s.id}`)}>
                  <div className="row between">
                    <strong>{s.name}</strong>
                    <span className={'pill'}><span className={'dot ' + s.status} />{s.status}</span>
                  </div>
                  <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                    {s.software} · {s.version || '—'} · :{s.port}
                  </p>
                  <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                    <span className="tag">{s.platform}</span>
                    {s.stats && <span className="tag">👥 {s.stats.players}/{s.maxPlayers}</span>}
                    {!s.installed && <span className="tag" style={{ color: 'var(--yellow)' }}>not installed</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

        {showCreate && (
          <div className="card" style={{ marginTop: 24 }}>
            <h2 className="title">Create a Server</h2>
            <form onSubmit={create}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="field">
                  <label>Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="My Server" />
                </div>
                <div className="field">
                  <label>Platform</label>
                  <select value={form.platform} onChange={(e) => onPlatformOrSoftwareChange({ ...form, platform: e.target.value })}>
                    <option value="java">Java</option>
                    <option value="bedrock">Bedrock</option>
                  </select>
                </div>
                <div className="field">
                  <label>Software</label>
                  <select value={form.software} onChange={(e) => onPlatformOrSoftwareChange({ ...form, software: e.target.value, version: '' })}>
                    {form.platform === 'java' ? (
                      <>
                        <option value="vanilla">Vanilla</option>
                        <option value="paper">Paper</option>
                        <option value="purpur">Purpur</option>
                        <option value="fabric">Fabric</option>
                        <option value="forge">Forge</option>
                        <option value="spigot">Spigot</option>
                      </>
                    ) : (
                      <option value="bedrock">Bedrock Dedicated</option>
                    )}
                  </select>
                </div>
                <div className="field">
                  <label>Version</label>
                  <input list="versions" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 1.21.4 or latest" />
                  <datalist id="versions">
                    {versions.map((v) => <option key={v} value={v} />)}
                  </datalist>
                  {versions.length > 0 && <span className="muted" style={{ fontSize: 11 }}>{versions.length} versions available</span>}
                </div>
                <div className="field">
                  <label>Port</label>
                  <input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label>Memory (MB)</label>
                  <input type="number" value={form.memoryMb} onChange={(e) => setForm({ ...form, memoryMb: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label>Max Players</label>
                  <input type="number" value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })} />
                </div>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text)' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={form.acceptEula}
                  onChange={(e) => setForm({ ...form, acceptEula: e.target.checked })} />
                I accept the Minecraft EULA (required to start)
              </label>
              <div className="row" style={{ marginTop: 12 }}>
                <button type="submit" className="primary">Create</button>
                <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
              {error && <div className="err">{error}</div>}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
