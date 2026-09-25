// Tuition for privately-funded slots: generation per period, discount, lateness and billing.
import { dueDateForMonth } from './dates';
import { activeFractionInMonth } from './children';
import type { ChildInput, Iso, Period } from './types';

export { dueDateForMonth as tuitionDueDateForMonth };

const utc = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};
const daysBetween = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / 86400000);

export function calculateCharge(baseAmount: number, discount = 0): number {
  return Math.max(0, Math.round((baseAmount - discount) * 100) / 100);
}

export interface NewTuition {
  school_id: unknown;
  child_id: unknown;
  period: Period;
  base_amount: number;
  discount: number;
  due_date: Iso;
}

// One tuition charge per child with a `private` slot active in the period (a positive day
// fraction). Who already has one isn't filtered here — the real idempotency is the unique index in
// the database; this function only decides WHO should have one.
export function generateMonthTuition(children: ChildInput[], period: Period, dueDay = 10): NewTuition[] {
  const [year, month] = period.split('-').map(Number) as [number, number];
  return children
    .filter((c) => c.enrollment_type === 'private' && activeFractionInMonth(c, year, month) > 0)
    .map((c) => ({
      school_id: c.school_id,
      child_id: c._id,
      period,
      base_amount: c.tuition_amount || 0,
      discount: 0,
      due_date: dueDateForMonth(period, dueDay),
    }))
    .filter((t) => t.base_amount > 0);
}

export type OverdueBracket = 'current' | '1-30' | '31-60' | '60+';

// Overdue bracket. A paid charge is never overdue, even past its due date.
export function overdueBracket(dueDate: Iso, today: Iso, paid = false): OverdueBracket {
  if (paid) return 'current';
  const daysLate = daysBetween(dueDate, today);
  if (daysLate <= 0) return 'current';
  if (daysLate <= 30) return '1-30';
  if (daysLate <= 60) return '31-60';
  return '60+';
}

export interface TuitionCharge { base_amount: number; discount?: number; due_date: Iso; paid_at?: Iso | null; period?: Period }

// Delinquency for the period: amount overdue ÷ amount of everything already due (paid or not).
export function delinquency(charges: TuitionCharge[], today: Iso): { totalDue: number; totalOverdue: number; pct: number | null } {
  const amountOf = (t: TuitionCharge): number => calculateCharge(t.base_amount, t.discount);
  const due = charges.filter((t) => t.due_date <= today);
  const overdue = due.filter((t) => !t.paid_at);
  const totalDue = due.reduce((s, t) => s + amountOf(t), 0);
  const totalOverdue = overdue.reduce((s, t) => s + amountOf(t), 0);
  return { totalDue, totalOverdue, pct: totalDue > 0 ? totalOverdue / totalDue : null };
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Billing message, with no sensitive data (never CPF).
export function chargeMessage(
  charge: { base_amount: number; discount?: number; period: Period; due_date: Iso },
  child: { name: string; guardian_name?: string },
  schoolName: string,
): string {
  const amount = calculateCharge(charge.base_amount, charge.discount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const [year, month] = charge.period.split('-') as [string, string];
  const guardianPrefix = child.guardian_name ? `${child.guardian_name}, ` : '';
  return `Olá, ${guardianPrefix}a mensalidade de ${child.name} (${schoolName}) referente a ${MONTHS[Number(month) - 1]}/${year} está no valor de ${amount}, com vencimento em ${charge.due_date.split('-').reverse().join('/')}.`;
}
