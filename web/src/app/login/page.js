'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken, getToken } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (typeof window !== 'undefined' && getToken()) {
    router.replace('/');
  }

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
        <div className="brand" style={{ marginBottom: 16 }}>VPS<span>Panel</span></div>
        <h2 className="title">Web VPS Terminal</h2>
        <p className="subtitle">Full Linux environment in your browser — terminal, file manager, run anything.</p>
        <div className="tabs" style={{ marginBottom: 18 }}>
          <button className={'tab ' + (mode === 'login' ? 'active' : '')} onClick={() => setMode('login')}>Login</button>
          <button className={'tab ' + (mode === 'register' ? 'active' : '')} onClick={() => setMode('register')}>Register</button>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="err">{error}</div>}
          <button className="primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
          Default: <span className="mono">admin / admin123</span>
        </p>
      </div>
    </div>
  );
}
