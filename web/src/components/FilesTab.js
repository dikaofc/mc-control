'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export default function FilesTab({ id }) {
  const [path, setPath] = useState('');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  async function load(p) {
    setError('');
    try { setItems(await api.files(id, p)); setPath(p); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(''); }, [id]);

  function openDir(name) { load(path ? path + '/' + name : name); }
  async function openFile(name) {
    try {
      const f = await api.readFile(id, path ? path + '/' + name : name);
      setEditing({ name: f.name, content: f.content });
    } catch (e) { setError(e.message); }
  }
  async function saveFile() {
    setBusy(true);
    try { await api.writeFile(id, path ? path + '/' + editing.name : editing.name, editing.content); setEditing(null); load(path); }
    catch (e) { setError(e.message); }
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

  function downloadFile(name) {
    const token = localStorage.getItem('vps_token');
    const url = `/api/projects/${id}/files/read?path=${encodeURIComponent(path ? path + '/' + name : name)}`;
    // Use fetch + blob for download
    fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => {
        const blob = new Blob([data.content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(e => setError(e.message));
  }

  async function handleUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of files) {
      const content = await file.text();
      const target = path ? path + '/' + file.name : file.name;
      try { await api.writeFile(id, target, content); }
      catch (err) { setError('Upload failed: ' + err.message); }
    }
    load(path);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  function formatDate(ms) {
    if (!ms) return '';
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  if (editing) {
    return (
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <strong>✏️ Editing: {editing.name}</strong>
          <button onClick={() => setEditing(null)}>← Back</button>
        </div>
        <textarea className="mono" rows={24} style={{ width: '100%' }} value={editing.content}
          onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={saveFile} disabled={busy}>
            {busy ? 'Saving…' : '💾 Save'}
          </button>
          <button onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <div>
          <strong>📁 Files</strong>
          <span className="muted"> / {path || 'root'}</span>
        </div>
        <div className="row">
          {path && <button onClick={() => { const up = path.split('/').slice(0, -1).join('/'); load(up); }}>↑ Up</button>}
          <button onClick={() => fileInputRef.current?.click()}>📤 Upload</button>
          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleUpload} />
        </div>
      </div>
      {error && <div className="err">{error}</div>}
      <table className="table">
        <thead><tr><th>Name</th><th>Size</th><th>Modified</th><th style={{ width: 200 }}>Actions</th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.path}>
              <td>
                <a onClick={() => it.isDir ? openDir(it.name) : openFile(it.name)} style={{ cursor: 'pointer' }}>
                  {it.isDir ? '📁 ' : '📄 '}{it.name}
                </a>
              </td>
              <td className="muted">{it.isDir ? '—' : formatSize(it.size)}</td>
              <td className="muted" style={{ fontSize: 12 }}>{formatDate(it.mtime)}</td>
              <td>
                {!it.isDir && <button onClick={() => openFile(it.name)} style={{ padding: '3px 8px' }}>Edit</button>}
                {!it.isDir && <button onClick={() => downloadFile(it.name)} style={{ padding: '3px 8px', marginLeft: 4 }}>⬇</button>}
                <button className="danger" onClick={() => del(it.name)} style={{ padding: '3px 8px', marginLeft: 4 }}>Del</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td className="muted" colSpan={4}>Empty folder</td></tr>}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 12 }}>
        <input className="flex1" value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createEntry()}
          placeholder="New file or folder/ (trailing slash = directory)" />
        <button className="blue" onClick={createEntry}>+ Create</button>
      </div>
    </div>
  );
}
