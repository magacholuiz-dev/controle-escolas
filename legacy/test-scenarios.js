import assert from 'node:assert/strict';
import { calculateSchool } from './calc.js';
import { applyAdjustments } from './scenarios.js';

const factors = Array(12).fill(1);
const baseInputs = {
  school: { payroll_tax_pct: 8, tax_pct: 6, initial_balance: 10000, vacation_month: 1 },
  employees: [{ _id: 'e1', salary: 3000, benefits: 500, active: 1, hire_date: '2023-01-10', vacation_periods_taken: 2 }],
  revenues: [{ monthly_amount: 20000, follows_calendar: 0 }],
  expenses: [{ monthly_amount: 2000, category: 'Alimentação', follows_calendar: 0 }],
  factors, entries: [], year: 2026,
};
const baseReport = calculateSchool(baseInputs);

// AC2: no adjustments produces exactly the same inputs (and therefore the same report).
const noop = applyAdjustments(baseInputs, []);
const noopReport = calculateSchool({ ...baseInputs, ...noop });
assert.deepEqual(noopReport, baseReport);

// AC1: delaying the transfer 2 months keeps the annual profit identical and never improves the min balance.
const delayed = applyAdjustments(baseInputs, [{ type: 'delay_transfer', months: 2 }]);
const delayedReport = calculateSchool({ ...baseInputs, ...delayed });
assert.equal(delayedReport.totals.result, baseReport.totals.result);
assert.ok(delayedReport.minBalance <= baseReport.minBalance);

// AC3: firing employee e1 in June adds the severance cost as a one-off in June and drops the salary from June on,
// without ever touching the real `baseInputs.employees` array.
const fired = applyAdjustments(baseInputs, [{ type: 'terminate', employee_id: 'e1', date: '2026-06-15', severance_type: 'without_cause' }]);
assert.deepEqual(baseInputs.employees, [{ _id: 'e1', salary: 3000, benefits: 500, active: 1, hire_date: '2023-01-10', vacation_periods_taken: 2 }]);
const firedReport = calculateSchool({ ...baseInputs, ...fired });
assert.equal(firedReport.months[5].salaries, 3000); // June still counts him (the termination month counts)
assert.equal(firedReport.months[6].salaries, 0); // July: gone
assert.ok(firedReport.months[5].expenses > baseReport.months[5].expenses); // June absorbed the severance cost

// Hiring adds a new employee from the given month on.
const hired = applyAdjustments(baseInputs, [{ type: 'hire', salary: 2000, hire_date: '2026-09-01' }]);
const hiredReport = calculateSchool({ ...baseInputs, ...hired });
assert.equal(hiredReport.months[7].salaries, 3000); // August: just the original employee
assert.equal(hiredReport.months[8].salaries, 5000); // September: plus the new hire

// Cutting an expense category by 30% scales only that category, and only within [0,1].
const cut = applyAdjustments(baseInputs, [{ type: 'cut_expense', category: 'Alimentação', pct: 0.3 }]);
const cutReport = calculateSchool({ ...baseInputs, ...cut });
assert.equal(cutReport.months[0].expenses, baseReport.months[0].expenses * 0.7);

// AC6: bad adjustments never throw — they show up as warnings, and the rest of the list still applies.
const messy = applyAdjustments(baseInputs, [
  { type: 'not_a_real_type' },
  { type: 'terminate', employee_id: 'does-not-exist', date: '2026-01-01' },
  { type: 'cut_expense', category: 'Alimentação', pct: 5 }, // out of range
  { type: 'delay_transfer', months: -1 }, // out of range
  { type: 'hire', salary: 1500, hire_date: '2026-01-01' }, // valid, should still land
]);
assert.equal(messy.warnings.length, 4);
assert.equal(messy.employees.length, 2); // the valid hire went through despite the other three failing
assert.doesNotThrow(() => calculateSchool({ ...baseInputs, ...messy }));

console.log('ok scenarios');
