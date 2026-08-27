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
        <div className="row between" style={{ marginBottom: 20 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="title">Workspaces</h1>
            <p className="subtitle">Your Linux environments. Terminal, file manager, run anything.</p>
          </div>
          <button className="primary" onClick={() => setShowCreate(true)} style={{ flexShrink: 0 }}>+ New</button>
        </div>

        {error && <div className="err">{error}</div>}

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <p className="muted">Loading workspaces...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>&#128187;</div>
            <p style={{ fontSize: 15, marginBottom: 16, color: 'var(--text-dim)' }}>No workspaces yet</p>
            <button className="primary" onClick={() => setShowCreate(true)}>+ Create First Workspace</button>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {projects.map((p) => (
              <div key={p.id} className="card" style={{ transition: 'all 0.25s var(--ease)' }}>
                <div className="row between" style={{ marginBottom: 10 }}>
                  <strong className="truncate" style={{ flex: 1, fontSize: 15 }}>{p.name}</strong>
                  <button className="danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => del(p.id)}>Delete</button>
                </div>
                <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                  <span className="pill"><span className="dot online" /> Active</span>
                  <span className="tag">{p.fileCount} files</span>
                </div>
                <button className="primary" style={{ width: '100%' }}
                  onClick={() => router.push(`/project?id=${p.id}`)}>Open Terminal</button>
              </div>
            ))}
          </div>
        )}

        {showCreate && (
          <div className="card" style={{ marginTop: 20 }}>
            <h2 className="title" style={{ fontSize: 17 }}>New Workspace</h2>
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
