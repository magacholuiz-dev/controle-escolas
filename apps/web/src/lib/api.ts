import type { SessionUser } from '@controle-escolas/contracts';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError'; }
}

// Same-origin: /api/* is proxied to the API by next.config.ts (first-party session cookie).
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('auth/login')) {
    window.location.href = '/login';
    throw new ApiError('sessão expirada', 401);
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new ApiError((data as { error?: string } | null)?.error || res.statusText, res.status);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export const qs = (params: Record<string, string | number | undefined | null>): string =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])).toString();

export const login = (email: string, password: string) => api.post<{ user: SessionUser }>('auth/login', { email, password });
export const downloadUrl = (path: string): string => `/api/${path}`;
