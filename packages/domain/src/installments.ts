// Installment purchases: turns "R$ 2.000 in 3x" or "10x of R$ 340" into the list of monthly
// installments. The server turns each one into a bill. Works in integer cents so the installments
// always add up to the total exactly.
import { InputError } from './errors';
import { daysInMonth } from './dates';

export const MAX_INSTALLMENTS = 60;

const toCents = (v: number): number => Math.round(Number(v) * 100);

interface Ymd { year: number; month: number; day: number }

function parseDate(s: string | undefined): Ymd {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) throw new InputError('data do 1º vencimento inválida (use AAAA-MM-DD)');
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw new InputError('data do 1º vencimento não existe no calendário');
  return { year, month, day };
}

// Due date of installment `index` (0-based): same day of the month as the first one, clamped to the
// month's length (a purchase due on the 31st is due on Feb 28/29, then back on the 31st in March).
function dueDate({ year, month, day }: Ymd, index: number): string {
  const total = year * 12 + (month - 1) + index;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const d = Math.min(day, daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface Installment { number: number; count: number; amount: number; due_date: string; period: string }
export interface InstallmentPlan { total: number; installments: Installment[] }

const blank = (v: unknown): boolean => v === undefined || v === null || v === '';

// Exactly one of `total` (split it across the installments) or `installmentAmount` (each installment
// costs this much; the total is that times `count`).
export function buildInstallments({ total, installmentAmount, count, firstDueDate }: {
  total?: unknown;
  installmentAmount?: unknown;
  count: unknown;
  firstDueDate?: string;
}): InstallmentPlan {
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > MAX_INSTALLMENTS) throw new InputError(`número de parcelas deve ser um inteiro de 1 a ${MAX_INSTALLMENTS}`);
  const hasTotal = !blank(total);
  const hasEach = !blank(installmentAmount);
  if (hasTotal === hasEach) throw new InputError('informe o valor total OU o valor de cada parcela (só um dos dois)');
  const value = Number(hasTotal ? total : installmentAmount);
  if (!Number.isFinite(value) || value <= 0) throw new InputError('o valor deve ser maior que zero');
  const first = parseDate(firstDueDate);

  const amounts: number[] = [];
  if (hasTotal) {
    const cents = toCents(value);
    const base = Math.floor(cents / n);
    if (base < 1) throw new InputError('o valor total é pequeno demais para esse número de parcelas');
    const extra = cents - base * n; // leftover cents go one each to the first installments
    for (let i = 0; i < n; i++) amounts.push((base + (i < extra ? 1 : 0)) / 100);
  } else {
    const each = toCents(value);
    for (let i = 0; i < n; i++) amounts.push(each / 100);
  }

  const installments = amounts.map((amount, i) => {
    const due = dueDate(first, i);
    return { number: i + 1, count: n, amount, due_date: due, period: due.slice(0, 7) };
  });
  const sumCents = installments.reduce((s, x) => s + toCents(x.amount), 0);
  return { total: sumCents / 100, installments };
}
