// Bills to pay: due dates, status and generation from recurring expenses. Pure function.
import { InputError } from './errors.js';

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

// Due date for the billing period, with the day clamped to the month's real length (e.g. day 30 in February).
export function dueDateForMonth(period, day = 10) {
  const m = /^(\d{4})-(\d{2})$/.exec(period || '');
  if (!m) throw new InputError(`competência inválida: ${period}`);
  const year = +m[1], month = +m[2];
  const d = Math.min(Math.max(1, day), daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Derived status: never stored, always computed against "today" (YYYY-MM-DD string).
export function billStatus(bill, today) {
  if (bill.paid_at) return 'paid';
  return bill.due_date < today ? 'overdue' : 'pending';
}

// One bill per recurring expense of the school, for the given period. Idempotent: skips expenses
// that already generated a bill for this period (enforced by the unique expense_id+period index).
export function generateMonthBills(expenses, period) {
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

// Summary for the Dashboard card: overdue bills and the ones due in the next `days`.
export function dueSummary(bills, today, days = 7) {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  const limitStr = limit.toISOString().slice(0, 10);
  const open = bills.filter((b) => !b.paid_at);
  const overdue = open.filter((b) => b.due_date < today).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const upcoming = open.filter((b) => b.due_date >= today && b.due_date <= limitStr).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const sum = (l) => l.reduce((s, b) => s + b.amount, 0);
  return { overdue, upcoming, totalOverdue: sum(overdue), totalUpcoming: sum(upcoming) };
}
