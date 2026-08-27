'use client';
import { useState } from 'react';
import { api } from '../lib/api';

export default function SettingsTab({ id, server, onSaved }) {
  const c = server.config || {};
  const [form, setForm] = useState({
    name: server.name, port: server.port, memoryMb: c.memoryMb, maxPlayers: c.maxPlayers,
    gamemode: c.gamemode, difficulty: c.difficulty, motd: c.motd || '',
    onlineMode: c.onlineMode, pvp: c.pvp, whitelist: c.whitelist, acceptEula: c.acceptEula,
    viewDistance: c.viewDistance, commandBlocks: c.commandBlocks, allowNether: c.allowNether,
    spawnProtection: c.spawnProtection,
  });
  const [msg, setMsg] = useState('');

  function set(k, v) { setForm({ ...form, [k]: v }); }

  async function save() {
    setMsg('');
    try {
      await api.updateServer(id, form);
      setMsg('Saved.');
      onSaved();
    } catch (e) { setMsg('Error: ' + e.message); }
  }

  return (
    <div className="card">
      <h2 className="title">Server Settings</h2>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 720 }}>
        <div className="field"><label>Name</label><input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label>Port</label><input type="number" value={form.port} onChange={(e) => set('port', Number(e.target.value))} /></div>
        <div className="field"><label>Memory (MB)</label><input type="number" value={form.memoryMb} onChange={(e) => set('memoryMb', Number(e.target.value))} /></div>
        <div className="field"><label>Max Players</label><input type="number" value={form.maxPlayers} onChange={(e) => set('maxPlayers', Number(e.target.value))} /></div>
        <div className="field"><label>Game Mode</label>
          <select value={form.gamemode} onChange={(e) => set('gamemode', e.target.value)}>
            <option>survival</option><option>creative</option><option>adventure</option><option>spectator</option>
          </select></div>
        <div className="field"><label>Difficulty</label>
          <select value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
            <option>peaceful</option><option>easy</option><option>normal</option><option>hard</option>
          </select></div>
        <div className="field"><label>View Distance</label><input type="number" value={form.viewDistance} onChange={(e) => set('viewDistance', Number(e.target.value))} /></div>
        <div className="field"><label>Spawn Protection</label><input type="number" value={form.spawnProtection} onChange={(e) => set('spawnProtection', Number(e.target.value))} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label>MOTD</label><input value={form.motd} onChange={(e) => set('motd', e.target.value)} /></div>
      </div>
      <div className="row wrap" style={{ gap: 16 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text)' }}><input type="checkbox" style={{ width: 'auto' }} checked={form.onlineMode} onChange={(e) => set('onlineMode', e.target.checked)} /> Online Mode</label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text)' }}><input type="checkbox" style={{ width: 'auto' }} checked={form.pvp} onChange={(e) => set('pvp', e.target.checked)} /> PvP</label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text)' }}><input type="checkbox" style={{ width: 'auto' }} checked={form.whitelist} onChange={(e) => set('whitelist', e.target.checked)} /> Whitelist</label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text)' }}><input type="checkbox" style={{ width: 'auto' }} checked={form.commandBlocks} onChange={(e) => set('commandBlocks', e.target.checked)} /> Command Blocks</label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text)' }}><input type="checkbox" style={{ width: 'auto' }} checked={form.allowNether} onChange={(e) => set('allowNether', e.target.checked)} /> Nether</label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text)' }}><input type="checkbox" style={{ width: 'auto' }} checked={form.acceptEula} onChange={(e) => set('acceptEula', e.target.checked)} /> Accept EULA</label>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="primary" onClick={save}>Save Settings</button>
        {msg && <span className={msg.startsWith('Error') ? 'err' : 'ok'}>{msg}</span>}
      </div>
    </div>
  );
}
