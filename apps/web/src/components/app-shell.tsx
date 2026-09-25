'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import type { School, SessionUser } from '@controle-escolas/contracts';
import { api } from '@/lib/api';
import { APP_SUBTITLE, APP_TITLE, NAV, NAV_GROUPS } from '@/lib/messages';
import { useApp } from '@/lib/store';
import { Loading } from './ui';
import { useDialogs } from './dialogs';

// Sidebar navigation (grouped by task; a drawer plus bottom bar on phones), top bar with the school/year filters; boots the session.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, schools, school, year, setSession, setSchool, setYear } = useApp();
  const { run } = useDialogs();
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
  const visible = NAV.filter((n) => !n.ownerOnly || user.role === 'owner');
  const link = (n: (typeof NAV)[number]) => (
    <Link key={n.href} href={n.href} className={current?.href === n.href ? 'on' : ''} aria-current={current?.href === n.href ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{n.label}</Link>
  );
  // Phone bottom bar: four destinations plus "Mais", which opens the full menu.
  const TABS = ['/painel', '/contas', '/lancamentos', '/receitas'].map((h) => visible.find((n) => n.href === h)).filter((n): n is (typeof NAV)[number] => !!n);

  return (
    <div className={`app${menuOpen ? ' menu-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">{APP_TITLE}<small>{APP_SUBTITLE}</small></div>
        <nav aria-label="Seções">
          {NAV_GROUPS.map((g) => {
            const items = visible.filter((n) => n.group === g);
            return items.length ? <div key={g} className="nav-group"><div className="nav-title">{g}</div>{items.map(link)}</div> : null;
          })}
        </nav>
        <div className="user-info">
          <span>{user.email}<br />{user.role === 'owner' ? 'Dona' : 'Diretora'}</span>
          <button type="button" className="sec" onClick={logout}>Sair</button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <div className="content">
        <header className="topbar">
          <button type="button" className="menu-btn sec" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">Menu</button>
          <h1>{current?.label ?? APP_TITLE}</h1>
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
        </header>
        <main className="wrap">{children}</main>
      </div>
      <div className="tabbar">
        {TABS.map((n) => <Link key={n.href} href={n.href} className={current?.href === n.href ? 'on' : ''}>{n.label.split(' ')[0]}</Link>)}
        <button type="button" onClick={() => setMenuOpen(true)}>Mais</button>
      </div>
    </div>
  );
}
