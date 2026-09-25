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
import { publicRevenueForMonth } from './children';
import { calculateSeverance } from './severance';
import type { CashFlow, CategoryTotals, EmployeeInput, EntryInput, MonthResult, Report, SchoolInputs, Totals } from './types';

const SUMMABLE: (keyof Totals)[] = ['revenue', 'derivedRevenue', 'salaries', 'benefits', 'charges', 'thirteenthProvision', 'vacationProvision', 'severanceProvision', 'expenses', 'taxes', 'accrualCost', 'result', 'cashIn', 'cashOut'];

// Numeric month fields summed when consolidating schools (everything but month, factor, balance).
const CONSOLIDATED_KEYS = [
  'revenue', 'derivedRevenue', 'salaries', 'benefits', 'charges', 'thirteenthProvision', 'vacationProvision', 'severanceProvision',
  'expenses', 'taxes', 'accrualCost', 'result', 'thirteenthPayout', 'vacationPayout', 'oneOffExpense', 'oneOffRevenue', 'cashIn', 'cashOut',
] as const;

// Does the employee count on the month's payroll? Without dates, `active` holds for the whole year.
export function activeInMonth(employee: EmployeeInput, year: number, month: number): boolean {
  if (!employee.active && !employee.termination_date) return false;
  if (!year) return true;
  const ref = year * 12 + month;
  const ym = (s: string): number => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7));
  if (employee.hire_date && ym(employee.hire_date) > ref) return false;
  if (employee.termination_date && ym(employee.termination_date) < ref) return false;
  return true;
}

export function calculateSchool({
  school, employees, revenues, expenses, factors, closedMonths = [], entries, year, children = [], schoolDays = [],
  revenueDelayMonths = 0, severanceReserve = null,
}: SchoolInputs): Report {
  const chargesPct = (school.payroll_tax_pct || 0) / 100;
  const taxPct = (school.tax_pct || 0) / 100;
  // Severance reserve (Loop 7): a monthly provision so a real severance never comes as a cash
  // surprise. It's the cost of firing (without cause) every currently active employee, hypothetically
  // on Dec 31st, times the yearly turnover rate, spread over the 12 months. It only ever touches
  // accrualCost/result, exactly like the 13th-salary and vacation provisions — never cashOut, since
  // no cash actually leaves until someone really goes.
  let severanceProvisionMonthly = 0;
  if ((severanceReserve?.turnoverPct ?? 0) > 0) {
    const hypotheticalDate = `${year}-12-31`;
    const totalCost = employees.filter((e) => e.active && e.hire_date).reduce((s, e) => {
      try {
        return s + calculateSeverance({
          salary: e.salary, hire_date: e.hire_date as string, termination_date: hypotheticalDate, type: 'without_cause',
          vacation_periods_taken: e.vacation_periods_taken || 0, fgts_balance: e.fgts_balance ?? null,
        }).schoolCost;
      } catch { return s; } // a bad hire_date (e.g. after year-end) just skips that employee's reserve
    }, 0);
    severanceProvisionMonthly = totalCost * ((severanceReserve as { turnoverPct: number }).turnoverPct / 100) / 12;
  }
  // Once the school has public-slot children on file, revenue becomes derived (children × school
  // days): the manual "follows calendar" revenues are superseded, so the city hall payment is never
  // counted twice. With no children on file, nothing changes.
  const hasPublicChildren = children.some((c) => c.enrollment_type === 'public');

  const months: MonthResult[] = Array.from({ length: 12 }, (_, i) => {
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
    const sumBy = (list: EntryInput[], type: EntryInput['type']): number => list.filter((l) => l.type === type).reduce((s, l) => s + l.amount, 0);
    const oneOffs = monthEntries.filter((l) => l.one_off);
    const oneOffRevenue = sumBy(oneOffs, 'revenue');
    const oneOffExpense = sumBy(oneOffs, 'expense');

    const accrualCost = salaries + benefits + charges + thirteenthProvision + vacationProvision + severanceProvisionMonthly + monthExpenses + taxes + oneOffExpense;
    const plannedCashOut = salaries + benefits + charges + monthExpenses + taxes + thirteenthPayout + vacationPayout + oneOffExpense;
    const closed = !!closedMonths[i];
    const actual = { n: monthEntries.length, revenue: sumBy(monthEntries, 'revenue'), expense: sumBy(monthEntries, 'expense') };

    return {
      month, factor, revenue: revenue + oneOffRevenue, derivedRevenue, salaries, benefits, charges, thirteenthProvision, vacationProvision,
      severanceProvision: severanceProvisionMonthly,
      expenses: monthExpenses + oneOffExpense, taxes, accrualCost, result: revenue + oneOffRevenue - accrualCost,
      thirteenthPayout, vacationPayout, oneOffExpense, oneOffRevenue, actual, closed,
      cashIn: closed ? actual.revenue : revenue + oneOffRevenue,
      cashOut: closed ? actual.expense : plannedCashOut,
      balance: 0, // filled by closeCashFlow
    };
  });

  // Budgeted vs. actual per expense category (whole year).
  const cats = new Map<string, CategoryTotals>();
  const category = (name: string): CategoryTotals => {
    let c = cats.get(name);
    if (!c) { c = { category: name, budgeted: 0, actual: 0, oneOff: 0 }; cats.set(name, c); }
    return c;
  };
  for (const e of expenses) {
    category(e.category || 'Outros').budgeted += factors.reduce((s, f) => s + e.monthly_amount * (e.follows_calendar ? f : 1), 0);
  }
  for (const l of entries.filter((x) => x.type === 'expense')) {
    const c = category(l.category || 'Outros');
    c.actual += l.amount;
    if (l.one_off) c.oneOff += l.amount; // same amount that feeds accrualCost above (via oneOffExpense)
  }

  // Scenario support (Loop 6): pushes cash in later without touching accrual revenue/result. Cash
  // that would have arrived before month 1 (from a negative source index) is simply lost from this
  // year's view — a documented approximation, since the app only models one year at a time.
  if (revenueDelayMonths > 0) {
    for (let i = 11; i >= 0; i--) {
      const source = i - revenueDelayMonths;
      (months[i] as MonthResult).cashIn = source >= 0 ? (months[source] as MonthResult).cashIn : 0;
    }
  }

  return { ...closeCashFlow(months, school.initial_balance || 0), categories: [...cats.values()] };
}

export function closeCashFlow(months: MonthResult[], initialBalance: number): CashFlow {
  let balance = initialBalance;
  for (const m of months) {
    balance += m.cashIn - m.cashOut;
    m.balance = balance;
  }
  const totals = {} as Totals;
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

export function consolidate(results: Report[], totalInitialBalance: number): Report {
  const months: MonthResult[] = Array.from({ length: 12 }, (_, i) => {
    const sums = Object.fromEntries(CONSOLIDATED_KEYS.map((k) => [k, 0])) as Record<(typeof CONSOLIDATED_KEYS)[number], number>;
    let closed = true;
    const actual = { n: 0, revenue: 0, expense: 0 };
    for (const r of results) {
      const m = r.months[i] as MonthResult;
      for (const k of CONSOLIDATED_KEYS) sums[k] += m[k];
      closed &&= m.closed;
      actual.n += m.actual.n; actual.revenue += m.actual.revenue; actual.expense += m.actual.expense;
    }
    const factor = results.length ? results.reduce((s, r) => s + (r.months[i] as MonthResult).factor, 0) / results.length : 1;
    return { month: i + 1, closed, actual, factor, balance: 0, ...sums };
  });
  const cats = new Map<string, CategoryTotals>();
  for (const r of results) {
    for (const c of r.categories) {
      let x = cats.get(c.category);
      if (!x) { x = { category: c.category, budgeted: 0, actual: 0, oneOff: 0 }; cats.set(c.category, x); }
      x.budgeted += c.budgeted; x.actual += c.actual; x.oneOff += c.oneOff;
    }
  }
  return { ...closeCashFlow(months, totalInitialBalance), categories: [...cats.values()] };
}
