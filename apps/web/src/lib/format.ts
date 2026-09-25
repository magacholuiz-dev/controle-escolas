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

// ---- pt-BR input parsing/formatting (the API keeps ISO dates and plain numbers) ----
// "1.234,56", "R$ 1.234,56", "1234,5", "12.5" -> number; anything unreadable -> null.
export function parseNumberBr(text: string): number | null {
  let t = text.replace(/R\$/g, '').replace(/\s/g, '');
  if (t === '' || !/^-?[\d.,]+$/.test(t)) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (!/^-?\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export const formatMoneyInput = (n: number): string => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatNumberInput = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });

// "22/09/2026" (or "22092026") -> "2026-09-22"; null when it is not a real calendar date.
export function dateBrToIso(text: string): string | null {
  const m = /^(\d{2})\/?(\d{2})\/?(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [, d, mo, y] = m as unknown as [string, string, string, string];
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return dt.getUTCFullYear() === Number(y) && dt.getUTCMonth() === Number(mo) - 1 && dt.getUTCDate() === Number(d) ? `${y}-${mo}-${d}` : null;
}
export const isoToBr = (iso: string | null | undefined): string => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? dateBr(iso.slice(0, 10)) : '');
// Inserts the slashes while typing: "22092026" -> "22/09/2026".
export const maskDateBr = (raw: string): string => {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};
// "09/2026" <-> "2026-09"
export const monthBrToIso = (t: string): string | null => { const m = /^(0[1-9]|1[0-2])\/?(\d{4})$/.exec(t.trim()); return m ? `${m[2]}-${m[1]}` : null; };
export const isoToMonthBr = (p: string): string => (/^\d{4}-\d{2}$/.test(p) ? `${p.slice(5)}/${p.slice(0, 4)}` : '');
export const maskMonthBr = (raw: string): string => { const d = raw.replace(/\D/g, '').slice(0, 6); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
