'use client';

import {useEffect, useState} from 'react';
import {usePathname} from 'next/navigation';
import {LogOut} from 'lucide-react';
import styles from './global-logout.module.css';

export default function GlobalLogout() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setSignedIn(false);
    fetch('/api/auth', {cache: 'no-store', signal: controller.signal})
      .then(async response => {
        const data = await response.json() as {member?: unknown};
        if (!controller.signal.aborted) setSignedIn(response.ok && !!data.member);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [pathname]);

  if (!signedIn) return null;

  async function logout() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'logout'}),
      });
      if (!response.ok) throw new Error('로그아웃하지 못했습니다. 다시 눌러 주세요.');
      window.location.assign('/login');
    } catch {
      setError('로그아웃하지 못했습니다. 다시 눌러 주세요.');
      setBusy(false);
    }
  }

  return <div className={styles.control}>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button type="button" className={styles.button} disabled={busy} onClick={logout}>
      <LogOut size={16} aria-hidden="true"/>
      {busy ? '로그아웃 중…' : '로그아웃'}
    </button>
  </div>;
}
