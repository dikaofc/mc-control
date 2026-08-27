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
        <div className="row between" style={{ marginBottom: 18 }}>
          <div>
            <h1 className="title">Workspaces</h1>
            <p className="subtitle">Your Linux environments. Each workspace has a terminal, file manager, and process runner.</p>
          </div>
          <button className="primary" onClick={() => setShowCreate(true)}>+ New Workspace</button>
        </div>

        {error && <div className="err">{error}</div>}

        {loading ? <p className="muted">Loading…</p> :
          projects.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p className="muted" style={{ fontSize: 16, marginBottom: 16 }}>No workspaces yet. Create your first one to get started.</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="primary" onClick={() => setShowCreate(true)}>+ New Workspace</button>
              </div>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {projects.map((p) => (
                <div key={p.id} className="card">
                  <div className="row between">
                    <strong>{p.name}</strong>
                    <button className="danger" style={{ padding: '3px 8px' }} onClick={() => del(p.id)}>Delete</button>
                  </div>
                  <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>{p.fileCount} files</p>
                  <button className="primary" style={{ marginTop: 10, width: '100%' }}
                    onClick={() => router.push(`/project?id=${p.id}`)}>Open Terminal →</button>
                </div>
              ))}
            </div>
          )}

        {showCreate && (
          <div className="card" style={{ marginTop: 24 }}>
            <h2 className="title">New Workspace</h2>
            <p className="subtitle">Each workspace is an isolated directory with its own terminal session.</p>
            <form onSubmit={create} className="row wrap" style={{ gap: 10 }}>
              <input className="flex1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name (e.g. my-app)" required />
              <button type="submit" className="primary">Create</button>
              <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
