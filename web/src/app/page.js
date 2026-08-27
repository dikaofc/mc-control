'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../components/Nav';
import { api, getToken } from '../lib/api';

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    load();
  }, []);

  async function load() {
    try { setProjects(await api.projects()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      const p = await api.createProject({ name: name || 'Workspace' });
      setShowCreate(false); setName('');
      router.push(`/project?id=${p.id}`);
    } catch (err) { setError(err.message); }
  }

  async function del(id) {
    if (!confirm('Delete this workspace and all its files?')) return;
    try { await api.deleteProject(id); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <Nav />
      <div className="container">
        <div className="row between" style={{ marginBottom: 16 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="title">Workspaces</h1>
            <p className="subtitle">Your Linux environments. Terminal, file manager, run anything.</p>
          </div>
          <button className="primary" onClick={() => setShowCreate(true)} style={{ flexShrink: 0 }}>+ New</button>
        </div>

        {error && <div className="err">{error}</div>}

        {loading ? <p className="muted">Loading...</p> :
          projects.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 32 }}>
              <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>No workspaces yet.</p>
              <button className="primary" onClick={() => setShowCreate(true)}>+ New Workspace</button>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {projects.map((p) => (
                <div key={p.id} className="card workspace-card">
                  <div className="row between">
                    <strong className="truncate" style={{ flex: 1 }}>{p.name}</strong>
                    <button className="danger" style={{ padding: '3px 8px', flexShrink: 0 }} onClick={() => del(p.id)}>Del</button>
                  </div>
                  <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>{p.fileCount} files</p>
                  <button className="primary" style={{ marginTop: 8, width: '100%' }}
                    onClick={() => router.push(`/project?id=${p.id}`)}>Open</button>
                </div>
              ))}
            </div>
          )}

        {showCreate && (
          <div className="card" style={{ marginTop: 20 }}>
            <h2 className="title">New Workspace</h2>
            <p className="subtitle">Isolated directory with its own terminal.</p>
            <form onSubmit={create}>
              <div className="field">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name (e.g. my-app)" autoFocus required />
              </div>
              <div className="row-mobile">
                <button type="submit" className="primary">Create</button>
                <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
