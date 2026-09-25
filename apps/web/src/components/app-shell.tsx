'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import type { School, SessionUser } from '@controle-escolas/contracts';
import { api } from '@/lib/api';
import { APP_SUBTITLE, APP_TITLE, NAV } from '@/lib/messages';
import { useApp } from '@/lib/store';
import { Loading } from './ui';
import { useDialogs } from './dialogs';

// Header with the school/year filters, the user, and the navigation; boots the session.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, schools, school, year, setSession, setSchool, setYear } = useApp();
  const { run } = useDialogs();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.all([api.get<{ user: SessionUser }>('auth/me'), api.get<School[]>('schools')])
      .then(([me, list]) => { setSession(me.user, list); setReady(true); })
      .catch(() => { /* 401 already redirected to /login */ });
  }, [setSession]);

  const current = NAV.find((n) => pathname.startsWith(n.href));
  // Records belong to one school: screens without a consolidated view switch "all" to the first school.
  useEffect(() => {
    if (ready && current && !current.allSchools && school === 'all' && schools[0]) setSchool(schools[0].id);
  }, [ready, current, school, schools, setSchool]);

  if (!ready || !user) return <main className="wrap"><Loading /></main>;

  const logout = () => run(async () => { await api.post('auth/logout'); window.location.href = '/login'; });

  return (
    <>
      <header>
        <div className="wrap">
          <h1>{APP_TITLE}<small>{APP_SUBTITLE}</small></h1>
          <div className="filters">
            <label>Escola
              <select value={school} onChange={(e) => setSchool(e.target.value)} aria-label="Escola">
                <option value="all">Todas (consolidado)</option>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>Ano
              <input type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Ano" />
            </label>
          </div>
          <nav style={{ width: '100%' }} aria-label="Seções">
            {NAV.filter((n) => !n.ownerOnly || user.role === 'owner').map((n) => (
              <Link key={n.href} href={n.href} className={current?.href === n.href ? 'on' : ''} aria-current={current?.href === n.href ? 'page' : undefined}>{n.label}</Link>
            ))}
          </nav>
          <div className="user-info">
            <span className="note">{user.email} · {user.role === 'owner' ? 'dona' : 'diretora'}</span>
            <button type="button" className="sec" onClick={logout}>Sair</button>
          </div>
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
