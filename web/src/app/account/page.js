'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../../components/Nav';
import { api, getToken, clearToken } from '../../lib/api';

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    api.me().then((d) => setUser(d.user)).catch(() => {});
  }, []);
  return (
    <div>
      <Nav />
      <div className="container" style={{ maxWidth: 520 }}>
        <h1 className="title">Account</h1>
        {user && (
          <div className="card">
            <div className="field"><label>Username</label><input value={user.username} disabled /></div>
            <div className="field"><label>Role</label><input value={user.role} disabled /></div>
            <div className="field"><label>User ID</label><input value={user.id} disabled className="mono" /></div>
            <button className="danger" onClick={() => { clearToken(); router.replace('/login'); }}>Log out</button>
          </div>
        )}
        <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
          The manager runs separately from this dashboard. Point <span className="mono">NEXT_PUBLIC_MANAGER_URL</span> at your deployed manager instance. See README.
        </p>
      </div>
    </div>
  );
}
