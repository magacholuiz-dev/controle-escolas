export const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

export const brl = (n: number | null | undefined): string => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl0 = (n: number | null | undefined): string => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const pct = (n: number): string => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';

// CSS class for a signed amount.
export const tone = (n: number): 'neg' | 'pos' | '' => (n < -0.005 ? 'neg' : n > 0.005 ? 'pos' : '');

export const dateBr = (iso: string): string => iso.split('-').reverse().join('/');
export const today = (): string => new Date().toISOString().slice(0, 10);
export const thisPeriod = (): string => new Date().toISOString().slice(0, 7);

// Compact axis label: R$ 12 mil, R$ 1,2 mi.
export function compact(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${s}R$ ${Math.round(a / 1e3)} mil`;
  return `${s}R$ ${Math.round(a)}`;
}

// Installment purchase preview, same rounding rule as the API (leftover cents go to the first ones).
export function installmentPreview(mode: 'total' | 'each', count: number, value: number): string {
  if (!(count >= 1) || !(value > 0)) return '';
  if (mode === 'each') return `${count}x de ${brl(value)} = total de ${brl(value * count)}`;
  const cents = Math.round(value * 100);
  const base = Math.floor(cents / count);
  const extra = cents - base * count;
  return extra
    ? `${count}x de ${brl((base + 1) / 100)} (as últimas ${brl(base / 100)}) = total de ${brl(value)}`
    : `${count}x de ${brl(base / 100)} = total de ${brl(value)}`;
}
