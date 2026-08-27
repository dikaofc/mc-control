'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../../components/Nav';
import { api, getToken, clearToken } from '../../lib/api';

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwOk, setPwOk] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    api.me().then((d) => setUser(d.user)).catch(() => {});
  }, []);

  async function changePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwOk('');
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    if (newPw.length < 4) { setPwError('Min 4 characters'); return; }
    setPwBusy(true);
    try {
      await api.changePassword(currentPw, newPw);
      setPwOk('Password changed!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) { setPwError(err.message); }
    finally { setPwBusy(false); }
  }

  return (
    <div>
      <Nav />
      <div className="container" style={{ maxWidth: 480 }}>
        <h1 className="title">Account</h1>
        {user && (
          <div className="card">
            <div className="field"><label>Username</label><input value={user.username} disabled /></div>
            <div className="field"><label>Role</label><input value={user.role} disabled /></div>
            <div className="field"><label>User ID</label><input value={user.id} disabled className="mono" style={{ fontSize: 11 }} /></div>
            <button className="danger" onClick={() => { clearToken(); router.replace('/login'); }}>Log out</button>
          </div>
        )}

        <div className="card" style={{ marginTop: 14 }}>
          <h2 className="title" style={{ fontSize: 16 }}>Change Password</h2>
          <form onSubmit={changePassword}>
            <div className="field">
              <label>Current Password</label>
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" required />
            </div>
            <div className="field">
              <label>New Password</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" required />
            </div>
            <div className="field">
              <label>Confirm New Password</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" required />
            </div>
            {pwError && <div className="err">{pwError}</div>}
            {pwOk && <div className="ok">{pwOk}</div>}
            <button className="primary" type="submit" disabled={pwBusy} style={{ marginTop: 8 }}>
              {pwBusy ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
