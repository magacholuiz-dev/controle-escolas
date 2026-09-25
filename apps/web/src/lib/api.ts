import type { SessionUser } from '@controle-escolas/contracts';

// The API speaks in field names and ISO dates; people read pt-BR.
const FIELD_LABELS: Record<string, string> = {
  paid_at: 'data do pagamento', amount_paid: 'valor pago', amount: 'valor', first_due_date: '1º vencimento', due_date: 'vencimento', hire_date: 'data de admissão',
  termination_date: 'data de desligamento', enrollment_date: 'data de matrícula', exit_date: 'data de saída', date: 'data', period: 'competência', year: 'ano',
  month: 'mês', school_id: 'escola', employee_id: 'colaborador', adjustments: 'ajustes', ofx: 'arquivo OFX', role: 'papel', kind: 'tipo', count: 'nº de parcelas',
  total_amount: 'valor total', installment_amount: 'valor da parcela', description: 'descrição', category: 'categoria', name: 'nome', email: 'e-mail', password: 'senha',
  monthly_amount: 'valor mensal', salary: 'salário', benefits: 'benefícios', discount: 'desconto', factor: 'fator', school_days: 'dias letivos', notice: 'aviso prévio',
};
export function friendlyError(message: string): string {
  let m = message.replace(/\(use AAAA-MM-DD\)/g, '(use dd/mm/aaaa)').replace(/\(use AAAA-MM\)/g, '(use mm/aaaa)')
    .replace(/deve ser owner ou director/g, 'deve ser dona ou diretora').replace(/deve ser bill ou tuition/g, 'deve ser conta ou mensalidade');
  m = m.replace(/\b[a-z]+(?:_[a-z]+)+\b|\b(?:date|period|year|month|amount|role|kind|count|ofx|name|email|password|salary|benefits|discount|factor|notice|category|description|adjustments)\b/g, (w) => FIELD_LABELS[w] ?? w);
  return m.charAt(0).toUpperCase() + m.slice(1);
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(friendlyError(message)); this.name = 'ApiError'; }
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
