'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export interface Fetched<T> { data: T | undefined; error: string | null; loading: boolean; reload: () => void }

// Minimal data hook: fetches `path` (skips when null), refetches when it changes or `reload()` is called.
export function useFetch<T>(path: string | null): Fetched<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (path === null) { setLoading(false); return; }
    const id = ++latest.current;
    setLoading(true);
    api.get<T>(path)
      .then((d) => { if (id === latest.current) { setData(d); setError(null); } })
      .catch((e: Error) => { if (id === latest.current) setError(e.message); })
      .finally(() => { if (id === latest.current) setLoading(false); });
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}
