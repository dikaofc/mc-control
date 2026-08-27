'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken, getToken } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace('/');
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn = mode === 'login' ? api.login : api.register;
      const res = await fn(username, password);
      setToken(res.token);
      router.replace('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="card auth-box">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="brand" style={{ fontSize: 28, marginBottom: 8, display: 'inline-block' }}>
            VPS<span>Panel</span>
          </div>
          <h2 className="title" style={{ fontSize: 20 }}>Web VPS Terminal</h2>
          <p className="subtitle" style={{ marginBottom: 0 }}>Full Linux environment in your browser</p>
        </div>

        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={'tab ' + (mode === 'login' ? 'active' : '')} onClick={() => setMode('login')} style={{ flex: 1, textAlign: 'center' }}>Login</button>
          <button className={'tab ' + (mode === 'register' ? 'active' : '')} onClick={() => setMode('register')} style={{ flex: 1, textAlign: 'center' }}>Register</button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" placeholder="Enter username" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Enter password" />
          </div>
          {error && <div className="err">{error}</div>}
          <button className="primary" style={{ width: '100%', marginTop: 12, padding: '12px 20px' }} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: 11, textAlign: 'center' }}>
          Default: <span className="mono">admin / admin123</span>
        </p>
      </div>
    </div>
  );
}
