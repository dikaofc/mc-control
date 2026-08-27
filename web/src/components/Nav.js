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
        <Link href="/" className="brand">MC<span>Control</span></Link>
        <Link href="/">Servers</Link>
        <Link href="/software">Software</Link>
        <div className="flex1" />
        <Link href="/account">Account</Link>
        <button onClick={logout} style={{ padding: '4px 10px' }}>Logout</button>
      </div>
    </div>
  );
}
