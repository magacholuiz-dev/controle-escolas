'use client';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type Toast = { id: number; text: string; kind: 'info' | 'error' };
type Pending =
  | { id: number; kind: 'confirm'; message: string; resolve: (v: boolean) => void }
  | { id: number; kind: 'prompt'; message: string; initial: string; resolve: (v: string | null) => void };

interface Dialogs {
  /** Replaces window.confirm: resolves true/false. */
  confirm: (message: string) => Promise<boolean>;
  /** Replaces window.prompt: resolves the text, or null when cancelled. */
  prompt: (message: string, initial?: string) => Promise<string | null>;
  /** Replaces window.alert. */
  notify: (text: string, kind?: 'info' | 'error') => void;
  /** Runs an async action; a failure becomes an error toast instead of an unhandled rejection. */
  run: (action: () => Promise<unknown>) => Promise<boolean>;
}

const Ctx = createContext<Dialogs | null>(null);

export function useDialogs(): Dialogs {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDialogs must be used inside <DialogProvider>');
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const notify = useCallback((text: string, kind: 'info' | 'error' = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4500);
  }, []);

  const value = useMemo<Dialogs>(() => ({
    confirm: (message) => new Promise((resolve) => setPending({ id: nextId.current++, kind: 'confirm', message, resolve })),
    prompt: (message, initial = '') => new Promise((resolve) => setPending({ id: nextId.current++, kind: 'prompt', message, initial, resolve })),
    notify,
    run: async (action) => {
      try { await action(); return true; } catch (e) { notify((e as Error).message || 'Algo deu errado.', 'error'); return false; }
    },
  }), [notify]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {pending && <Modal key={pending.id} pending={pending} close={() => setPending(null)} />}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>{t.text}</div>)}
      </div>
    </Ctx.Provider>
  );
}

function Modal({ pending, close }: { pending: Pending; close: () => void }) {
  const [text, setText] = useState(pending.kind === 'prompt' ? pending.initial : '');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);

  const done = (ok: boolean) => {
    if (pending.kind === 'confirm') pending.resolve(ok);
    else pending.resolve(ok ? text : null);
    close();
  };

  return (
    <div className="overlay" onKeyDown={(e) => { if (e.key === 'Escape') done(false); }}>
      <form className="dialog" role="dialog" aria-modal="true" onSubmit={(e) => { e.preventDefault(); done(true); }}>
        <p>{pending.message}</p>
        {pending.kind === 'prompt' && <input ref={input} value={text} onChange={(e) => setText(e.target.value)} aria-label={pending.message} />}
        <div className="row">
          <button type="button" className="cancel" onClick={() => done(false)}>Cancelar</button>
          <button type="submit" autoFocus={pending.kind === 'confirm'}>OK</button>
        </div>
      </form>
    </div>
  );
}
