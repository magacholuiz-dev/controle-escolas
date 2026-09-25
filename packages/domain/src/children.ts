// Public-school revenue derived from enrolled children.
//
// Formula (confirmed with the owner on 2026-09-22): rate per child × school days in the month.
// Entry/exit mid-month: proportional to calendar days (the app keeps only the month's total of
// school days, so spreading them evenly across the calendar month is the simplest defensible
// approximation).
import { InputError } from './errors';
import { daysInMonth, isoDate } from './dates';
import type { ChildInput, Iso } from './types';

// Is the child enrolled on a given day?
export function isActiveOn(child: ChildInput, isoDay: Iso): boolean {
  if (child.enrollment_date && child.enrollment_date > isoDay) return false;
  if (child.exit_date && child.exit_date < isoDay) return false;
  return true;
}

// Fraction of the month (0 to 1) the child was enrolled, by calendar days.
export function activeFractionInMonth(child: ChildInput, year: number, month: number): number {
  const totalDays = daysInMonth(year, month);
  const monthStart = isoDate(year, month, 1);
  const monthEnd = isoDate(year, month, totalDays);
  if (child.enrollment_date && child.enrollment_date > monthEnd) return 0;
  if (child.exit_date && child.exit_date < monthStart) return 0;
  const enrolledFrom = child.enrollment_date && child.enrollment_date > monthStart ? child.enrollment_date : monthStart;
  const enrolledUntil = child.exit_date && child.exit_date < monthEnd ? child.exit_date : monthEnd;
  const startDay = Number(enrolledFrom.slice(8, 10));
  const endDay = Number(enrolledUntil.slice(8, 10));
  return Math.max(0, Math.min(1, (endDay - startDay + 1) / totalDays));
}

interface PublicRevenueParams {
  children: ChildInput[];
  childDailyRate: number | null | undefined;
  schoolDays: number | null | undefined;
  year: number;
  month: number;
}

// Public (city-hall funded) revenue for the month, from children with a `public` enrollment slot.
export function publicRevenueForMonth({ children, childDailyRate, schoolDays, year, month }: PublicRevenueParams): number {
  if (!((childDailyRate ?? 0) > 0) || !((schoolDays ?? 0) > 0)) return 0;
  const totalFraction = children.filter((c) => c.enrollment_type === 'public').reduce((s, c) => s + activeFractionInMonth(c, year, month), 0);
  return totalFraction * (childDailyRate as number) * (schoolDays as number);
}

export interface Occupancy { active: number; capacity: number | null; pct: number | null }

// Occupancy: children active today ÷ school capacity. `null` when capacity isn't set (never divides by zero).
export function occupancy(children: ChildInput[], capacity: number | null | undefined, today: Iso): Occupancy {
  const active = children.filter((c) => isActiveOn(c, today)).length;
  if (!((capacity ?? 0) > 0)) return { active, capacity: null, pct: null };
  return { active, capacity: capacity as number, pct: active / (capacity as number) };
}

export function validateChild({ enrollment_date, exit_date }: { enrollment_date?: Iso | null; exit_date?: Iso | null }): void {
  if (enrollment_date && exit_date && exit_date < enrollment_date) {
    throw new InputError('a data de saída não pode ser antes da data de matrícula');
  }
}
