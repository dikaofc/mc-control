'use client';
import { useRouter } from 'next/navigation';
import { clearToken } from '../lib/api';

export default function Nav() {
  const router = useRouter();
  function logout() {
    clearToken();
    router.replace('/login');
  }
  return (
    <div className="nav">
      <div className="nav-inner">
        <a href="/" className="brand">MC<span>Control</span></a>
        <a href="/">Servers</a>
        <a href="/software">Software</a>
        <div className="flex1" />
        <a href="/account">Account</a>
        <button onClick={logout} style={{ padding: '4px 10px' }}>Logout</button>
      </div>
    </div>
  );
}
