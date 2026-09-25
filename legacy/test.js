import assert from 'node:assert/strict';
import { calculateSchool } from './calc.js';

const factors = [0, 0.5, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1];
const r = calculateSchool({
  school: { payroll_tax_pct: 8, tax_pct: 6, initial_balance: 0, vacation_month: 1 },
  employees: [{ salary: 3000, benefits: 500, active: 1, vacation_month: null }, { salary: 9999, benefits: 0, active: 0 }],
  revenues: [{ monthly_amount: 20000, follows_calendar: 1 }],
  expenses: [{ monthly_amount: 2000, follows_calendar: 1 }, { monthly_amount: 1000, follows_calendar: 0 }],
  factors,
  entries: [],
});
const [jan, feb, mar, , , , jul, , , , nov, dec] = r.months;

assert.equal(jan.revenue, 0);            // city hall doesn't pay in January
assert.equal(feb.revenue, 10000);        // half of February
assert.equal(jul.revenue, 0);
assert.equal(mar.revenue, 20000);
assert.equal(jan.expenses, 1000);        // only the fixed expense (meals here don't follow the calendar = 2000*0)
assert.equal(mar.expenses, 3000);
assert.equal(mar.charges, 240);          // 8% of 3000, ignores the inactive one
assert.equal(mar.thirteenthProvision, 270);   // 3000/12 * 1.08
assert.equal(mar.vacationProvision, 90);      // 3000/3/12 * 1.08
assert.equal(mar.taxes, 1200);
assert.equal(jan.vacationPayout, 1080);  // 1/3 of 3000 + 8%
assert.equal(nov.thirteenthPayout, 1620);     // half of the 13th + 8%
assert.equal(dec.thirteenthPayout, 1620);
// January: no revenue, but pays payroll + fixed costs + vacation bonus => negative cash
assert.equal(jan.cashOut, 3000 + 500 + 240 + 1000 + 0 + 0 + 1080);
assert.ok(jan.balance < 0);
assert.ok(r.reserveNeeded > 0);

// Open month: a regular entry doesn't change cash; a one-off adds to the plan
const base = {
  school: { payroll_tax_pct: 8, tax_pct: 6, initial_balance: 0, vacation_month: 1 },
  employees: [], revenues: [{ monthly_amount: 100, follows_calendar: 0 }], expenses: [{ monthly_amount: 10, category: 'Luz', follows_calendar: 0 }], factors, year: 2026,
};
let r2 = calculateSchool({ ...base, entries: [
  { date: '2026-03-10', type: 'expense', category: 'Luz', amount: 12, one_off: 0 },
  { date: '2026-03-12', type: 'expense', category: 'Material de limpeza', amount: 50, one_off: 1 },
] });
assert.equal(r2.months[2].cashOut, 10 + 0 + 50 + 0.06 * 100);   // planned 10 + one-off 50 + tax 6
assert.deepEqual(r2.categories.find((c) => c.category === 'Luz'), { category: 'Luz', budgeted: 120, actual: 12, oneOff: 0 });

// AC6 (Loop 4): a one-off entry's amount is tracked separately from other actual entries, so the
// income statement can use budgeted+oneOff (what feeds the profit) instead of the full actual.
const r2b = calculateSchool({ ...base, entries: [
  { date: '2026-03-10', type: 'expense', category: 'Luz', amount: 12, one_off: 0 },
  { date: '2026-03-12', type: 'expense', category: 'Luz', amount: 999, one_off: 1 },
] });
assert.deepEqual(r2b.categories.find((c) => c.category === 'Luz'), { category: 'Luz', budgeted: 120, actual: 1011, oneOff: 999 });

// Closed month: cash flow uses only the actual entries
r2 = calculateSchool({ ...base, closedMonths: [false, false, true], entries: [{ date: '2026-03-10', type: 'revenue', amount: 777 }] });
assert.equal(r2.months[2].cashIn, 777);
assert.equal(r2.months[2].cashOut, 0);
assert.equal(r2.months[3].cashIn, 100);

// An employee only counts in the months they're actually employed
const r3 = calculateSchool({ ...base, expenses: [], revenues: [], entries: [], employees: [
  { salary: 1000, benefits: 0, active: 0, hire_date: '2025-01-10', termination_date: '2026-03-20' },
  { salary: 2000, benefits: 0, active: 1, hire_date: '2026-06-01' },
] });
assert.equal(r3.months[2].salaries, 1000);   // Mar: only the terminated one (the termination month counts)
assert.equal(r3.months[3].salaries, 0);      // Apr: nobody
assert.equal(r3.months[5].salaries, 2000);   // Jun: the new hire

// AC4: a school with no children on file gets EXACTLY the same revenue as before Loop 2.
const baseWithEntries = { ...base, entries: [] };
const noChildren = calculateSchool({ ...baseWithEntries, children: [], schoolDays: [] });
const noNewParams = calculateSchool(baseWithEntries); // doesn't even pass the new parameters
assert.deepEqual(noChildren, noNewParams);
assert.equal(noChildren.months[2].revenue, 100); // the manual revenue (without follows_calendar) still counts

// AC1/AC4b: with public-slot children on file, the manual "follows calendar" revenue stops
// counting (avoids double-counting) and the derived one takes over: 1 child, 20 school days, R$15/day = R$300.
const schoolWithChildren = { ...baseWithEntries, school: { ...base.school, child_daily_rate: 15 },
  revenues: [{ monthly_amount: 60000, follows_calendar: 1 }, { monthly_amount: 100, follows_calendar: 0 }],
  children: [{ enrollment_type: 'public' }], schoolDays: Array(12).fill(20) };
const r4 = calculateSchool(schoolWithChildren);
assert.equal(r4.months[2].revenue, 300 + 100); // derived + the manual one that doesn't follow the calendar
assert.equal(r4.months[2].derivedRevenue, 300);

// AC3: school_days affects the derived revenue without touching factor (which still drives expenses)
const variedSchoolDays = Array(12).fill(20); variedSchoolDays[1] = 10; // February with half the school days
const r5 = calculateSchool({ ...schoolWithChildren, schoolDays: variedSchoolDays });
assert.equal(r5.months[1].derivedRevenue, 150);
assert.equal(r5.months[1].factor, factors[1]); // the transfer factor (for expenses) doesn't change

// Loop 6 (scenarios): revenueDelayMonths shifts cashIn without touching accrual revenue/result.
const noDelay = calculateSchool({ ...baseWithEntries });
const delayZero = calculateSchool({ ...baseWithEntries, revenueDelayMonths: 0 });
assert.deepEqual(delayZero, noDelay); // omitting it or passing 0 must be byte-identical
const delayed = calculateSchool({ ...baseWithEntries, revenueDelayMonths: 2 });
assert.equal(delayed.totals.result, noDelay.totals.result); // accrual profit never moves
assert.equal(delayed.months[0].cashIn, 0); // nothing to shift in from "month -2"
assert.equal(delayed.months[1].cashIn, 0); // "month -1"
assert.equal(delayed.months[2].cashIn, noDelay.months[0].cashIn); // January's cash now lands in March
assert.equal(delayed.months[11].cashIn, noDelay.months[9].cashIn);
assert.equal(delayed.months[0].revenue, noDelay.months[0].revenue); // accrual revenue stays put

// Loop 7 (severance reserve): off by default (turnoverPct 0 or severanceReserve omitted) is byte-identical.
const employeeWithHire = { salary: 3000, benefits: 500, active: 1, hire_date: '2023-03-10', vacation_periods_taken: 3 };
const reserveInputs = { ...baseWithEntries, employees: [employeeWithHire] };
const noReserve = calculateSchool(reserveInputs);
assert.deepEqual(calculateSchool({ ...reserveInputs, severanceReserve: { turnoverPct: 0 } }), noReserve);
assert.deepEqual(calculateSchool({ ...reserveInputs, severanceReserve: null }), noReserve);

// With turnoverPct on, the annual result drops by exactly totalSeveranceCost × turnoverPct, and cash is untouched.
const withReserve = calculateSchool({ ...reserveInputs, severanceReserve: { turnoverPct: 20 } });
assert.equal(withReserve.totals.cashOut, noReserve.totals.cashOut); // never a cash effect
// totals.severanceProvision is 12x the monthly provision, i.e. exactly totalCost x turnoverPct already.
assert.ok(Math.abs(withReserve.totals.result - (noReserve.totals.result - withReserve.totals.severanceProvision)) < 0.005);
assert.ok(withReserve.totals.severanceProvision > 0);

console.log('ok');
