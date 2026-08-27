'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Nav from '../../components/Nav';
import { api, getToken } from '../../lib/api';
import Terminal from '../../components/Terminal';
import FilesTab from '../../components/FilesTab';
import ProcessesTab from '../../components/ProcessesTab';
import SystemTab from '../../components/SystemTab';

const TABS = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'files', label: 'Files' },
  { id: 'processes', label: 'Processes' },
  { id: 'system', label: 'System' },
];

function ProjectPage() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id');
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('terminal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    if (!id) { setLoading(false); setError('No workspace id in URL.'); return; }
    api.getProject(id).then(setProject).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  if (!id) return <div className="container muted" style={{ paddingTop: 40 }}>No workspace selected. <a href="/">Go back</a>.</div>;
  if (loading) return <div className="container muted" style={{ paddingTop: 40 }}>Loading...</div>;
  if (error && !project) return <div className="container"><div className="err">{error}</div></div>;

  return (
    <div>
      <Nav />
      <div className="container">
        <div className="row between" style={{ marginBottom: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="title truncate">{project.name}</h1>
            <p className="subtitle">VPS Workspace - {project.fileCount} files</p>
          </div>
          <button onClick={() => router.push('/')} style={{ flexShrink: 0 }}>Back</button>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={'tab ' + (tab === t.id ? 'active' : '')} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {tab === 'terminal' && <Terminal projectId={id} />}
        {tab === 'files' && <FilesTab id={id} />}
        {tab === 'processes' && <ProcessesTab id={id} />}
        {tab === 'system' && <SystemTab />}
      </div>
    </div>
  );
}

export default function ProjectPageWithSuspense() {
  return (
    <Suspense fallback={<div className="container muted" style={{ paddingTop: 40 }}>Loading...</div>}>
      <ProjectPage />
    </Suspense>
  );
}
