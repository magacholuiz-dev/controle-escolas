'use client';
import { type FormEvent, useState } from 'react';
import { login } from '@/lib/api';
import { APP_SUBTITLE, APP_TITLE } from '@/lib/messages';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      await login(String(form.get('email')), String(form.get('password')));
      window.location.href = '/painel';
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 423
        ? 'Conta bloqueada temporariamente por várias tentativas erradas. Tente novamente em alguns minutos.'
        : status ? (err as Error).message || 'E-mail ou senha inválidos.' : 'Não foi possível conectar ao servidor.');
    } finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1 style={{ margin: '0 0 4px' }}>{APP_TITLE}</h1>
        <div className="sub">{APP_SUBTITLE}</div>
        <form onSubmit={submit}>
          <label>E-mail <input name="email" type="email" required autoComplete="username" /></label>
          <label>Senha <input name="password" type="password" required autoComplete="current-password" /></label>
          <button type="submit" disabled={busy}>Entrar</button>
          <div className="login-error" role="alert">{error}</div>
        </form>
      </div>
    </div>
  );
}
