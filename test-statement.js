import assert from 'node:assert/strict';
import { calculateSchool } from './calc.js';
import { buildStatement, DEFAULT_CATEGORY_GROUPS } from './statement.js';

const factors = Array(12).fill(1);
const report = calculateSchool({
  school: { payroll_tax_pct: 8, tax_pct: 6, initial_balance: 0, vacation_month: 1 },
  employees: [{ salary: 3000, benefits: 500, active: 1 }],
  revenues: [{ monthly_amount: 20000, follows_calendar: 0 }],
  expenses: [
    { monthly_amount: 1000, category: 'Segurança', follows_calendar: 0 },
    { monthly_amount: 500, category: 'Alimentação', follows_calendar: 0 },
    { monthly_amount: 200, category: 'Nova categoria não mapeada', follows_calendar: 0 },
  ],
  factors,
  entries: [{ date: '2026-01-10', type: 'expense', category: 'Rescisão', amount: 3000, one_off: 1 }],
  year: 2026,
});

// AC1: the statement's result matches the report's profit exactly, no rounding slack.
const s = buildStatement(report);
assert.equal(s.result, report.totals.result);

// AC3: the revenue line is exactly the report's revenue.
assert.equal(s.groups.find((g) => g.group === 'Receita bruta').amount, report.totals.revenue);

// AC5: an unmapped category falls into "Não classificado" and is listed for the caller to warn about.
assert.deepEqual(s.unclassified, ['Nova categoria não mapeada']);
assert.ok(s.groups.find((g) => g.group === 'Não classificado').amount < 0);

// AC2: moving "Segurança" from Administrativo to Operacional changes both groups but not the total.
const moved = buildStatement(report, { ...DEFAULT_CATEGORY_GROUPS, 'Segurança': 'Operacional' });
const before = Object.fromEntries(s.groups.map((g) => [g.group, g.amount]));
const after = Object.fromEntries(moved.groups.map((g) => [g.group, g.amount]));
assert.notEqual(before.Administrativo, after.Administrativo);
assert.notEqual(before.Operacional, after.Operacional);
assert.equal(moved.result, s.result);

// AC6: a severance one-off is grouped under "Pessoal", together with the fixed payroll line.
const payroll = -(report.totals.salaries + report.totals.benefits + report.totals.charges + report.totals.thirteenthProvision + report.totals.vacationProvision);
assert.equal(s.groups.find((g) => g.group === 'Pessoal').amount, payroll - 3000);

// AC6: an ordinary (non one-off) actual entry never enters the statement, matching the profit.
const reportWithTracking = calculateSchool({
  school: { payroll_tax_pct: 0, tax_pct: 0, initial_balance: 0, vacation_month: 1 },
  employees: [], revenues: [{ monthly_amount: 100, follows_calendar: 0 }],
  expenses: [{ monthly_amount: 10, category: 'Luz', follows_calendar: 0 }],
  factors, year: 2026,
  entries: [{ date: '2026-03-10', type: 'expense', category: 'Luz', amount: 999, one_off: 0 }],
});
const s2 = buildStatement(reportWithTracking);
assert.equal(s2.result, reportWithTracking.totals.result);
assert.notEqual(s2.result, 100 * 12 - 10 * 12 - 999); // proves the 999 tracking entry was NOT double-subtracted

// Consolidated report: the invariant still holds when summing two schools.
const { consolidate } = await import('./calc.js');
const consolidated = consolidate([report, reportWithTracking], 0);
const s3 = buildStatement(consolidated);
assert.equal(s3.result, consolidated.totals.result);

console.log('ok statement');
