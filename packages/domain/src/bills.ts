// Bills to pay: due dates, status and generation from recurring expenses.
import { dueDateForMonth } from './dates';
import type { Iso, Period } from './types';

export { dueDateForMonth as billDueDateForMonth };

export type BillStatus = 'paid' | 'overdue' | 'pending';

// Derived status: never stored, always computed against "today" (YYYY-MM-DD string).
export function billStatus(bill: { paid_at?: Iso | null; due_date: Iso }, today: Iso): BillStatus {
  if (bill.paid_at) return 'paid';
  return bill.due_date < today ? 'overdue' : 'pending';
}

export interface RecurringExpense {
  _id?: unknown;
  school_id?: unknown;
  description: string;
  category?: string;
  monthly_amount: number;
  due_day?: number | null;
}
export interface NewBill {
  school_id: unknown;
  expense_id: unknown;
  description: string;
  category: string;
  period: Period;
  due_date: Iso;
  amount: number;
}

// One bill per recurring expense of the school, for the given period. Idempotent at the caller:
// expenses that already generated a bill for this period are skipped by the unique
// expense_id+period index.
export function generateMonthBills(expenses: RecurringExpense[], period: Period): NewBill[] {
  return expenses.map((e) => ({
    school_id: e.school_id,
    expense_id: e._id,
    description: e.description,
    category: e.category || 'Outros',
    period,
    due_date: dueDateForMonth(period, e.due_day || 10),
    amount: e.monthly_amount,
  })).filter((b) => b.amount > 0);
}

export interface OpenBill { due_date: Iso; paid_at?: Iso | null; amount: number }

// Summary for the Dashboard card: overdue bills and the ones due in the next `days`.
export function dueSummary<T extends OpenBill>(bills: T[], today: Iso, days = 7): { overdue: T[]; upcoming: T[]; totalOverdue: number; totalUpcoming: number } {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  const limitStr = limit.toISOString().slice(0, 10);
  const open = bills.filter((b) => !b.paid_at);
  const overdue = open.filter((b) => b.due_date < today).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const upcoming = open.filter((b) => b.due_date >= today && b.due_date <= limitStr).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const sum = (l: T[]): number => l.reduce((s, b) => s + b.amount, 0);
  return { overdue, upcoming, totalOverdue: sum(overdue), totalUpcoming: sum(upcoming) };
}
