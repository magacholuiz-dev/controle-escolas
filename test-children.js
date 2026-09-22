import assert from 'node:assert/strict';
import { isActiveOn, activeFractionInMonth, publicRevenueForMonth, occupancy, validateChild } from './children.js';

// activeFractionInMonth: full month, no entry/exit
assert.equal(activeFractionInMonth({}, 2026, 4), 1);

// AC2: leaves on day 10 of a 20-calendar-day month (Feb/2026 isn't a leap year -> 28 days, so we use
// April, 30 days, to test the exact fraction from the formula, since a 20-calendar-day month doesn't exist.
assert.equal(activeFractionInMonth({ exit_date: '2026-04-10' }, 2026, 4), 10 / 30); // 10 calendar days out of 30
assert.equal(activeFractionInMonth({ enrollment_date: '2026-04-21' }, 2026, 4), 10 / 30); // enrolled on day 21: 10 days to the end (21..30)
assert.equal(activeFractionInMonth({ exit_date: '2026-03-31' }, 2026, 4), 0); // left before the month
assert.equal(activeFractionInMonth({ enrollment_date: '2026-05-01' }, 2026, 4), 0); // enrolls after the month
assert.equal(activeFractionInMonth({ enrollment_date: '2026-04-01', exit_date: '2026-04-30' }, 2026, 4), 1);

// AC1: full month, 20 school days, R$15/day -> R$300
const child1 = { enrollment_type: 'public' };
assert.equal(publicRevenueForMonth({ children: [child1], childDailyRate: 15, schoolDays: 20, year: 2026, month: 10 }), 300);

// AC2: leaves on day 10 of a 20-calendar-day month -> 50% of 300 = 150
// (a 20-calendar-day civil month doesn't exist; we simulate it by multiplying the 10/20 fraction directly)
const midMonth = { enrollment_type: 'public', exit_date: '2026-04-10' }; // April has 30 calendar days
const full = publicRevenueForMonth({ children: [{ enrollment_type: 'public' }], childDailyRate: 15, schoolDays: 20, year: 2026, month: 4 });
const partial = publicRevenueForMonth({ children: [midMonth], childDailyRate: 15, schoolDays: 20, year: 2026, month: 4 });
assert.equal(partial, full * (10 / 30));
// and zero in the following month
assert.equal(publicRevenueForMonth({ children: [midMonth], childDailyRate: 15, schoolDays: 20, year: 2026, month: 5 }), 0);

// a private slot doesn't count toward the public revenue
assert.equal(publicRevenueForMonth({ children: [{ enrollment_type: 'private' }], childDailyRate: 15, schoolDays: 20, year: 2026, month: 10 }), 0);

// AC3: school_days affects revenue linearly, without depending on `factor`
assert.equal(publicRevenueForMonth({ children: [child1], childDailyRate: 15, schoolDays: 10, year: 2026, month: 2 }), 150);

// no rate or no school days on file -> zero (never generates revenue "in the dark")
assert.equal(publicRevenueForMonth({ children: [child1], childDailyRate: 0, schoolDays: 20, year: 2026, month: 10 }), 0);
assert.equal(publicRevenueForMonth({ children: [child1], childDailyRate: 15, schoolDays: 0, year: 2026, month: 10 }), 0);
assert.equal(publicRevenueForMonth({ children: [], childDailyRate: 15, schoolDays: 20, year: 2026, month: 10 }), 0);

// isActiveOn
assert.equal(isActiveOn({ enrollment_date: '2026-01-10', exit_date: '2026-06-30' }, '2026-03-01'), true);
assert.equal(isActiveOn({ enrollment_date: '2026-01-10' }, '2026-01-01'), false);
assert.equal(isActiveOn({ exit_date: '2026-01-10' }, '2026-01-20'), false);

// AC5: occupancy, and it never divides by zero when there's no capacity
assert.deepEqual(occupancy([{ enrollment_date: null, exit_date: null }, { exit_date: '2020-01-01' }], 70, '2026-09-22'), { active: 1, capacity: 70, pct: 1 / 70 });
assert.deepEqual(occupancy([{}], null, '2026-09-22'), { active: 1, capacity: null, pct: null });
assert.deepEqual(occupancy([{}], 0, '2026-09-22'), { active: 1, capacity: null, pct: null });

// AC7: date validation
assert.throws(() => validateChild({ enrollment_date: '2026-06-01', exit_date: '2026-01-01' }));
validateChild({ enrollment_date: '2026-01-01', exit_date: '2026-06-01' }); // doesn't throw

console.log('ok children');
