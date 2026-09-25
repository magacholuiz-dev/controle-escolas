import { InputError } from './errors';

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();
export const isoDate = (year: number, month: number, day: number): string => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// Due date for a billing period ("YYYY-MM"), with the day clamped to the month's real length
// (e.g. day 30 in February).
export function dueDateForMonth(period: string, day = 10): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period || '');
  if (!m) throw new InputError(`competência inválida: ${period}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const d = Math.min(Math.max(1, day), daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
