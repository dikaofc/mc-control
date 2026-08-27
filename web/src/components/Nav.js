'use client';
import Link from 'next/link';
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
        <Link href="/" className="brand">VPS<span>Panel</span></Link>
        <Link href="/">Workspaces</Link>
        <div className="flex1" />
        <Link href="/account">Account</Link>
        <button onClick={logout} style={{ padding: '4px 10px' }}>Logout</button>
      </div>
    </div>
  );
}
