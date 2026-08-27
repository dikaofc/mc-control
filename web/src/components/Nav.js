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
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">VPS<span>Panel</span></Link>
        <Link href="/">Workspaces</Link>
        <div className="flex1" />
        <Link href="/account">Account</Link>
        <button onClick={logout} style={{ padding: '5px 12px', fontSize: 12 }}>Logout</button>
      </div>
    </nav>
  );
}
