import assert from 'node:assert/strict';
import { vacationAlerts, billAboveAverageAlerts, negativeCashAlerts, generateAlerts } from './alerts.js';

// AC1: 60 days out (or less) alerts; 61+ doesn't. Deadline = hire_date + 12*(taken+2) months.
// Employee hired 2024-01-01, 0 periods taken -> deadline 2026-01-01.
const emp = (overrides) => ({ active: 1, hire_date: '2024-01-01', vacation_periods_taken: 0, name: 'Ana', ...overrides });
assert.equal(vacationAlerts([emp()], '2025-11-02').length, 1); // 60 days before 2026-01-01
assert.equal(vacationAlerts([emp()], '2025-11-01').length, 0); // 61 days before -> no alert
assert.equal(vacationAlerts([emp()], '2026-02-01').length, 1); // past the deadline: still alerts
assert.equal(vacationAlerts([emp()], '2026-02-01')[0].level, 'critical');
assert.equal(vacationAlerts([emp({ active: 0 })], '2025-11-02').length, 0); // inactive: ignored
assert.equal(vacationAlerts([emp({ hire_date: null })], '2025-11-02').length, 0); // no hire date: ignored

// AC2: > 20% above average alerts; exactly 20% or less doesn't.
const billsFor = (currentAmount, ...priorAmounts) => {
  const periods = ['2026-05', '2026-06', '2026-07', '2026-08'];
  const amounts = [...priorAmounts, currentAmount];
  return periods.slice(4 - amounts.length).map((period, i) => ({ category: 'Luz', period, amount: amounts[i] }));
};
assert.equal(billAboveAverageAlerts(billsFor(125, 100, 100, 100), '2026-08').length, 1); // 25% above
assert.equal(billAboveAverageAlerts(billsFor(120, 100, 100, 100), '2026-08').length, 0); // exactly 20%: not above
assert.equal(billAboveAverageAlerts(billsFor(121, 100, 100, 100), '2026-08').length, 1); // just over 20%
assert.equal(billAboveAverageAlerts([{ category: 'Luz', period: '2026-08', amount: 999 }], '2026-08').length, 0); // no history: skip
assert.equal(billAboveAverageAlerts(billsFor(125, 100, 100, 100), '2026-09').length, 0); // no bill in the current period: nothing to flag

// AC3: negative balance in months +1..+3 from currentMonth alerts; the current month and month +4 don't.
const monthsFrom = (balances) => balances.map((balance, i) => ({ month: i + 1, balance }));
const negIn = (m) => monthsFrom(Array.from({ length: 12 }, (_, i) => (i + 1 === m ? -100 : 100)));
assert.equal(negativeCashAlerts(negIn(6), 5).length, 1); // month 6 = currentMonth+1
assert.equal(negativeCashAlerts(negIn(8), 5).length, 1); // month 8 = currentMonth+3
assert.equal(negativeCashAlerts(negIn(9), 5).length, 0); // month 9 = currentMonth+4: too far
assert.equal(negativeCashAlerts(negIn(5), 5).length, 0); // the current month itself doesn't count as "coming up"
assert.equal(negativeCashAlerts(negIn(6), 0).length, 0); // currentMonth falsy (report isn't for this year): skip entirely
assert.match(negativeCashAlerts(negIn(6), 5)[0].title, /junho/);

// AC5-adjacent: with nothing wrong, generateAlerts returns an empty array (never throws, never null).
const clean = generateAlerts({ employees: [], bills: [], months: monthsFrom(Array(12).fill(1000)), today: '2026-09-23', currentMonth: 9 });
assert.deepEqual(clean, []);

// AC6: an employee missing a hire_date, or a turnover-less/garbage entry, never throws.
assert.doesNotThrow(() => generateAlerts({ employees: [{ active: 1, name: 'Sem data' }], bills: [{ category: 'x' }], months: [], today: '2026-09-23' }));

console.log('ok alerts');
