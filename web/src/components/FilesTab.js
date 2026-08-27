'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function FilesTab({ id }) {
  const [path, setPath] = useState('');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // {name, content}
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(p) {
    setError('');
    try { setItems(await api.files(id, p)); setPath(p); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(''); }, [id]);

  function openDir(name) {
    const next = path ? path + '/' + name : name;
    load(next);
  }
  async function openFile(name) {
    try {
      const f = await api.readFile(id, path ? path + '/' + name : name);
      setEditing({ name: f.name, content: f.content });
    } catch (e) { setError(e.message); }
  }
  async function saveFile() {
    setBusy(true);
    try {
      await api.writeFile(id, path ? path + '/' + editing.name : editing.name, editing.content);
      setEditing(null); load(path);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function del(name) {
    if (!confirm('Delete ' + name + '?')) return;
    try { await api.deletePath(id, path ? path + '/' + name : name); load(path); }
    catch (e) { setError(e.message); }
  }
  async function createEntry() {
    if (!newName.trim()) return;
    try { await api.createPath(id, path ? path + '/' + newName : newName, newName.endsWith('/')); setNewName(''); load(path); }
    catch (e) { setError(e.message); }
  }

  if (editing) {
    return (
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <strong>Editing: {editing.name}</strong>
          <button onClick={() => setEditing(null)}>Back</button>
        </div>
        <textarea className="mono" rows={22} style={{ width: '100%' }} value={editing.content}
          onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={saveFile} disabled={busy}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <div>
          <strong>Files</strong> <span className="muted">/ {path || 'root'}</span>
        </div>
        <div className="row">
          {path && <button onClick={() => { const up = path.split('/').slice(0, -1).join('/'); load(up); }}>↑ Up</button>}
        </div>
      </div>
      {error && <div className="err">{error}</div>}
      <table className="table">
        <thead><tr><th>Name</th><th>Size</th><th style={{ width: 160 }}>Actions</th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.path}>
              <td>
                <a onClick={() => it.isDir ? openDir(it.name) : openFile(it.name)} style={{ cursor: 'pointer' }}>
                  {it.isDir ? '📁 ' : '📄 '}{it.name}
                </a>
              </td>
              <td className="muted">{it.isDir ? '—' : (it.size / 1024).toFixed(1) + ' KB'}</td>
              <td>
                {!it.isDir && <button onClick={() => openFile(it.name)} style={{ padding: '3px 8px' }}>Edit</button>}
                <button className="danger" onClick={() => del(it.name)} style={{ padding: '3px 8px', marginLeft: 6 }}>Del</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td className="muted" colSpan={3}>Empty folder</td></tr></tbody>}
        </table>
      <div className="row" style={{ marginTop: 12 }}>
        <input className="flex1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="new file or folder/ (trailing slash = dir)" />
        <button className="blue" onClick={createEntry}>Create</button>
      </div>
    </div>
  );
}
