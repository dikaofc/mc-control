'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const INTERVALS = [
  ['every5m', 'Every 5 min'], ['every15m', 'Every 15 min'], ['every30m', 'Every 30 min'],
  ['hourly', 'Hourly'], ['daily', 'Daily'],
];
const ACTIONS = [['command', 'Run command'], ['start', 'Start server'], ['stop', 'Stop server']];

export default function ScheduleTab({ id }) {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ name: '', interval: 'daily', action: 'command', payload: '' });
  const [msg, setMsg] = useState('');

  async function load() {
    try { setTasks(await api.schedule(id)); } catch (e) { setMsg(e.message); }
  }
  useEffect(() => { load(); }, [id]);

  async function add(e) {
    e.preventDefault(); setMsg('');
    try { await api.addTask(id, form); setForm({ name: '', interval: 'daily', action: 'command', payload: '' }); load(); }
    catch (e) { setMsg(e.message); }
  }
  async function update(taskId, patch) {
    try { await api.updateTask(id, taskId, patch); load(); } catch (e) { setMsg(e.message); }
  }
  async function remove(taskId) {
    if (!confirm('Delete this scheduled task?')) return;
    try { await api.removeTask(id, taskId); load(); } catch (e) { setMsg(e.message); }
  }

  return (
    <div className="card">
      <h2 className="title">Scheduled Tasks</h2>
      <p className="subtitle">Automate commands and start/stop cycles.</p>
      <form onSubmit={add} className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', maxWidth: 820, marginBottom: 16 }}>
        <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Daily restart" /></div>
        <div className="field"><label>Interval</label>
          <select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })}>
            {INTERVALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div className="field"><label>Action</label>
          <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
            {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label>Command / Payload</label>
          <input value={form.payload} onChange={(e) => setForm({ ...form, payload: e.target.value })} placeholder="e.g. save-all or broadcast Server restarting!" /></div>
        <button className="primary" type="submit">Add Task</button>
      </form>
      {msg && <div className="err">{msg}</div>}
      <table className="table">
        <thead><tr><th>Name</th><th>Interval</th><th>Action</th><th>Payload</th><th>Enabled</th><th style={{ width: 120 }}>Actions</th></tr></thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td className="muted">{t.interval}</td>
              <td className="muted">{t.action}</td>
              <td className="muted mono" style={{ fontSize: 12 }}>{t.payload}</td>
              <td><input type="checkbox" style={{ width: 'auto' }} checked={t.enabled} onChange={(e) => update(t.id, { enabled: e.target.checked })} /></td>
              <td><button className="danger" onClick={() => remove(t.id)} style={{ padding: '3px 8px' }}>Remove</button></td>
            </tr>
          ))}
          {tasks.length === 0 && <tr><td className="muted" colSpan={6}>No scheduled tasks</td></tr>}</tbody>
        </table>
    </div>
  );
}
