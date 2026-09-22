// Pure financial calculation (no database access), so it stays testable.
//
// Two views per month:
//  - Accrual (profit): revenue - costs, with the 13th salary and vacation PROVISIONED every month.
//  - Cash: what actually comes in/out; the 13th goes out in Nov/Dec, the 1/3 vacation bonus in the
//    employee's vacation month.
//
// Vacation assumption: the vacation month's salary is already in the regular payroll, so the extra
// cash outlay is just the 1/3 constitutional bonus (+ charges). Monthly provision = (salary/3)/12.
//
// Ledger entries:
//  - Open month: only "one-off" entries (outside the budget) add to the plan;
//    the rest are only used to track budgeted vs. actual per category.
//  - Closed month: cash flow uses only the actual entries (every entry that month).

import { publicRevenueForMonth } from './children.js';

const SUMMABLE = ['revenue', 'derivedRevenue', 'salaries', 'benefits', 'charges', 'thirteenthProvision', 'vacationProvision', 'expenses', 'taxes', 'accrualCost', 'result', 'cashIn', 'cashOut'];

// Does the employee count on the month's payroll? Without dates, `active` holds for the whole year.
export function activeInMonth(employee, year, month) {
  if (!employee.active && !employee.termination_date) return false;
  if (!year) return true;
  const ref = year * 12 + month;
  const ym = (s) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7));
  if (employee.hire_date && ym(employee.hire_date) > ref) return false;
  if (employee.termination_date && ym(employee.termination_date) < ref) return false;
  return true;
}

export function calculateSchool({ school, employees, revenues, expenses, factors, closedMonths = [], entries, year, children = [], schoolDays = [] }) {
  const chargesPct = (school.payroll_tax_pct || 0) / 100;
  const taxPct = (school.tax_pct || 0) / 100;
  // Once the school has public-slot children on file, revenue becomes derived (children × school
  // days): the manual "follows calendar" revenues are superseded, so the city hall payment is never
  // counted twice. With no children on file, nothing changes (AC4).
  const hasPublicChildren = children.some((c) => c.enrollment_type === 'public');

  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const factor = factors[i] ?? 1;
    const activeStaff = employees.filter((e) => activeInMonth(e, year, month));

    const manualRevenue = revenues.reduce((s, r) => s + r.monthly_amount * (r.follows_calendar && !hasPublicChildren ? factor : r.follows_calendar ? 0 : 1), 0);
    const derivedRevenue = hasPublicChildren
      ? publicRevenueForMonth({ children, childDailyRate: school.child_daily_rate, schoolDays: schoolDays[i], year, month })
      : 0;
    const revenue = manualRevenue + derivedRevenue;
    const monthExpenses = expenses.reduce((s, e) => s + e.monthly_amount * (e.follows_calendar ? factor : 1), 0);
    const salaries = activeStaff.reduce((s, e) => s + e.salary, 0);
    const benefits = activeStaff.reduce((s, e) => s + (e.benefits || 0), 0);
    const charges = salaries * chargesPct;
    const thirteenthProvision = (salaries / 12) * (1 + chargesPct);
    const vacationProvision = (salaries / 3 / 12) * (1 + chargesPct);
    const taxes = revenue * taxPct;

    // Cash
    const thirteenthPayout = month === 11 || month === 12 ? (salaries / 2) * (1 + chargesPct) : 0;
    const vacationPayout = activeStaff
      .filter((e) => (e.vacation_month || school.vacation_month) === month)
      .reduce((s, e) => s + (e.salary / 3) * (1 + chargesPct), 0);

    // One-offs (severances, one-time purchases) add to the month's cost on top of the budget.
    const monthEntries = entries.filter((l) => Number(l.date.slice(5, 7)) === month);
    const sumBy = (list, type) => list.filter((l) => l.type === type).reduce((s, l) => s + l.amount, 0);
    const oneOffs = monthEntries.filter((l) => l.one_off);
    const oneOffRevenue = sumBy(oneOffs, 'revenue');
    const oneOffExpense = sumBy(oneOffs, 'expense');

    const accrualCost = salaries + benefits + charges + thirteenthProvision + vacationProvision + monthExpenses + taxes + oneOffExpense;
    const plannedCashOut = salaries + benefits + charges + monthExpenses + taxes + thirteenthPayout + vacationPayout + oneOffExpense;
    const closed = !!closedMonths[i];
    const actual = { n: monthEntries.length, revenue: sumBy(monthEntries, 'revenue'), expense: sumBy(monthEntries, 'expense') };

    return {
      month, factor, revenue: revenue + oneOffRevenue, derivedRevenue, salaries, benefits, charges, thirteenthProvision, vacationProvision,
      expenses: monthExpenses + oneOffExpense, taxes, accrualCost, result: revenue + oneOffRevenue - accrualCost,
      thirteenthPayout, vacationPayout, oneOffExpense, oneOffRevenue, actual, closed,
      cashIn: closed ? actual.revenue : revenue + oneOffRevenue,
      cashOut: closed ? actual.expense : plannedCashOut,
    };
  });

  // Budgeted vs. actual per expense category (whole year).
  const cats = new Map();
  const category = (name) => cats.get(name) ?? cats.set(name, { category: name, budgeted: 0, actual: 0 }).get(name);
  for (const e of expenses) {
    category(e.category || 'Outros').budgeted += factors.reduce((s, f) => s + e.monthly_amount * (e.follows_calendar ? f : 1), 0);
  }
  for (const l of entries.filter((x) => x.type === 'expense')) category(l.category || 'Outros').actual += l.amount;

  return { ...closeCashFlow(months, school.initial_balance || 0), categories: [...cats.values()] };
}

export function closeCashFlow(months, initialBalance) {
  let balance = initialBalance;
  for (const m of months) {
    balance += m.cashIn - m.cashOut;
    m.balance = balance;
  }
  const totals = {};
  for (const k of SUMMABLE) totals[k] = months.reduce((s, m) => s + m[k], 0);
  const balances = months.map((m) => m.balance);
  const minBalance = Math.min(...balances);
  return {
    months,
    totals,
    initialBalance,
    finalBalance: balance,
    minBalance,
    minBalanceMonth: balances.indexOf(minBalance) + 1,
    // Cash that would be missing in the worst month (0 if cash never goes negative).
    reserveNeeded: Math.max(0, -minBalance),
    margin: totals.revenue ? totals.result / totals.revenue : 0,
  };
}

export function consolidate(results, totalInitialBalance) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const sum = { month: i + 1, closed: true, actual: { n: 0, revenue: 0, expense: 0 } };
    for (const r of results) {
      const m = r.months[i];
      for (const k of Object.keys(m)) if (typeof m[k] === 'number' && !['month', 'factor', 'balance'].includes(k)) sum[k] = (sum[k] || 0) + m[k];
      sum.closed &&= m.closed;
      for (const k of ['n', 'revenue', 'expense']) sum.actual[k] += m.actual[k];
    }
    sum.factor = results.length ? results.reduce((s, r) => s + r.months[i].factor, 0) / results.length : 1;
    return sum;
  });
  const cats = new Map();
  for (const r of results) for (const c of r.categories) {
    const x = cats.get(c.category) ?? cats.set(c.category, { category: c.category, budgeted: 0, actual: 0 }).get(c.category);
    x.budgeted += c.budgeted; x.actual += c.actual;
  }
  return { ...closeCashFlow(months, totalInitialBalance), categories: [...cats.values()] };
}
