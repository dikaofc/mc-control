'use client';
import { useEffect, useState } from 'react';

// Allow static export: the id is read client-side from the URL, so we don't
// need server-side params generation.
export const dynamic = 'force-static';
import { useParams } from 'next/navigation';
import Nav from '../../../components/Nav';
import { api, getToken, consoleSocket } from '../../../lib/api';
import ConsoleTab from '../../../components/ConsoleTab';
import SettingsTab from '../../../components/SettingsTab';
import PlayersTab from '../../../components/PlayersTab';
import FilesTab from '../../../components/FilesTab';
import BackupsTab from '../../../components/BackupsTab';
import AddonsTab from '../../../components/AddonsTab';
import ScheduleTab from '../../../components/ScheduleTab';

const TABS = [
  { id: 'console', label: 'Console' },
  { id: 'settings', label: 'Settings' },
  { id: 'players', label: 'Players' },
  { id: 'files', label: 'Files' },
  { id: 'backups', label: 'Backups' },
  { id: 'addons', label: 'Plugins / Mods' },
  { id: 'schedule', label: 'Scheduler' },
];

export default function ServerPage() {
  const { id } = useParams();
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('console');
  const [error, setError] = useState('');

  async function load() {
    try {
      const s = await api.getServer(id);
      setServer(s);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!getToken()) { window.location.href = '/login'; return; }
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [id]);

  async function start() { try { await api.start(id); load(); } catch (e) { setError(e.message); } }
  async function stop() { try { await api.stop(id); load(); } catch (e) { setError(e.message); } }
  async function restart() { try { await api.restart(id); load(); } catch (e) { setError(e.message); } }

  if (loading) return <div className="container muted" style={{ paddingTop: 40 }}>Loading…</div>;
  if (error && !server) return <div className="container"><div className="err">{error}</div></div>;
  if (!server) return <div className="container muted">Server not found.</div>;

  const st = server.status;
  const live = st === 'online' || st === 'starting' || st === 'stopping';

  return (
    <div>
      <Nav />
      <div className="container">
        <div className="row between" style={{ marginBottom: 16 }}>
          <div>
            <h1 className="title">{server.name}</h1>
            <p className="subtitle">{server.software} {server.version} · :{server.port} · {server.platform}</p>
          </div>
          <div className="row">
            <span className={'pill'}><span className={'dot ' + st} />{st}</span>
            {!live ? (
              <button className="primary" onClick={start}>Start</button>
            ) : (
              <>
                <button className="blue" onClick={restart}>Restart</button>
                <button className="danger" onClick={stop}>Stop</button>
              </>
            )}
          </div>
        </div>

        {server.stats && live && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row wrap" style={{ gap: 24 }}>
              <div><div className="muted" style={{ fontSize: 12 }}>Players</div><strong>{server.stats.players}/{server.config?.maxPlayers || '?'}</strong></div>
              <div><div className="muted" style={{ fontSize: 12 }}>Uptime</div><strong>{Math.floor(server.stats.uptimeMs / 60000)}m</strong></div>
              <div><div className="muted" style={{ fontSize: 12 }}>CPU</div><strong>{server.stats.cpuPercent}%</strong></div>
              <div><div className="muted" style={{ fontSize: 12 }}>Memory</div><strong>{(server.stats.memBytes / 1048576).toFixed(0)} MB</strong></div>
              <div><div className="muted" style={{ fontSize: 12 }}>PID</div><strong>{server.stats.pid || '—'}</strong></div>
            </div>
          </div>
        )}

        {!server.installed && (
          <div className="card" style={{ marginBottom: 16, borderColor: 'var(--yellow)' }}>
            <strong>Server not installed.</strong> Choose a software version and install it before starting.
            <div style={{ marginTop: 10 }}>
              <InstallBox id={id} current={server} onDone={load} />
            </div>
          </div>
        )}

        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={'tab ' + (tab === t.id ? 'active' : '')} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {tab === 'console' && <ConsoleTab id={id} server={server} />}
        {tab === 'settings' && <SettingsTab id={id} server={server} onSaved={load} />}
        {tab === 'players' && <PlayersTab id={id} />}
        {tab === 'files' && <FilesTab id={id} />}
        {tab === 'backups' && <BackupsTab id={id} />}
        {tab === 'addons' && <AddonsTab id={id} server={server} />}
        {tab === 'schedule' && <ScheduleTab id={id} />}
      </div>
    </div>
  );
}

function InstallBox({ id, current, onDone }) {
  const [software, setSoftware] = useState(current.software || 'vanilla');
  const [version, setVersion] = useState('latest');
  const [versions, setVersions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.versions(software).then((v) => setVersions(v.map((x) => x.version || x.id || x))).catch(() => setVersions([]));
  }, [software]);

  async function install() {
    setBusy(true); setMsg('Downloading & installing…');
    try {
      await api.install(id, software, version === 'latest' ? (versions[versions.length - 1] || 'latest') : version);
      setMsg('Installed!');
      onDone();
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="row wrap" style={{ gap: 10 }}>
      <select style={{ width: 180 }} value={software} onChange={(e) => setSoftware(e.target.value)}>
        <option value="vanilla">Vanilla</option>
        <option value="paper">Paper</option>
        <option value="purpur">Purpur</option>
        <option value="fabric">Fabric</option>
        <option value="forge">Forge</option>
        <option value="bedrock">Bedrock</option>
      </select>
      <input style={{ width: 180 }} list="iv" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="version" />
      <datalist id="iv">{versions.map((v) => <option key={v} value={v} />)}</datalist>
      <button className="primary" onClick={install} disabled={busy}>{busy ? 'Installing…' : 'Install'}</button>
      {msg && <span className="muted">{msg}</span>}
    </div>
  );
}
