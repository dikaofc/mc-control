'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function PlayersTab({ id }) {
  const [ops, setOps] = useState([]);
  const [wl, setWl] = useState([]);
  const [bans, setBans] = useState([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  async function loadAll() {
    try {
      const [o, w, b] = await Promise.all([api.ops(id), api.whitelist(id), api.bans(id)]);
      setOps(o); setWl(w); setBans(b);
    } catch (e) { setMsg(e.message); }
  }
  useEffect(() => { loadAll(); }, [id]);

  async function add(kind) {
    if (!name.trim()) return;
    setMsg('');
    try {
      if (kind === 'op') await api.addOp(id, name);
      if (kind === 'wl') await api.addWhitelist(id, name);
      if (kind === 'ban') await api.ban(id, name);
      setName(''); loadAll();
    } catch (e) { setMsg(e.message); }
  }
  async function rem(kind, n) {
    setMsg('');
    try {
      if (kind === 'op') await api.removeOp(id, n);
      if (kind === 'wl') await api.removeWhitelist(id, n);
      if (kind === 'ban') await api.unban(id, n);
      loadAll();
    } catch (e) { setMsg(e.message); }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <div className="card">
        <h3 className="title" style={{ fontSize: 16 }}>Operators</h3>
        <div className="row" style={{ marginBottom: 10 }}>
          <input className="flex1" value={name} onChange={(e) => setName(e.target.value)} placeholder="player name" />
          <button className="blue" onClick={() => add('op')}>Add</button>
        </div>
        <table className="table"><tbody>
          {ops.map((o) => <tr key={o.name}><td>{o.name}</td><td style={{ textAlign: 'right' }}><button className="danger" onClick={() => rem('op', o.name)}>Remove</button></td></tr>)}
          {ops.length === 0 && <tr><td className="muted">No operators</td></tr></tbody>}
        </table>
      </div>

      <div className="card">
        <h3 className="title" style={{ fontSize: 16 }}>Whitelist</h3>
        <div className="row" style={{ marginBottom: 10 }}>
          <input className="flex1" value={name} onChange={(e) => setName(e.target.value)} placeholder="player name" />
          <button className="blue" onClick={() => add('wl')}>Add</button>
        </div>
        <table className="table"><tbody>
          {wl.map((w) => <tr key={w.name}><td>{w.name}</td><td style={{ textAlign: 'right' }}><button className="danger" onClick={() => rem('wl', w.name)}>Remove</button></td></tr>)}
          {wl.length === 0 && <tr><td className="muted">Whitelist empty</td></tr></tbody>}
        </table>
      </div>

      <div className="card">
        <h3 className="title" style={{ fontSize: 16 }}>Bans</h3>
        <div className="row" style={{ marginBottom: 10 }}>
          <input className="flex1" value={name} onChange={(e) => setName(e.target.value)} placeholder="player name" />
          <button className="danger" onClick={() => add('ban')}>Ban</button>
        </div>
        <table className="table"><tbody>
          {bans.map((b) => <tr key={(b.name || b)}><td>{b.name || b}</td><td style={{ textAlign: 'right' }}><button className="blue" onClick={() => rem('ban', b.name || b)}>Unban</button></td></tr>)}
          {bans.length === 0 && <tr><td className="muted">No bans</td></tr></tbody>}
        </table>
      </div>

      {msg && <div className="err" style={{ gridColumn: '1 / -1' }}>{msg}</div>}
    </div>
  );
}
