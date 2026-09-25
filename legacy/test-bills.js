import assert from 'node:assert/strict';
import { dueDateForMonth, billStatus, generateMonthBills, dueSummary } from './bills.js';

// Due date: normal day and the day clamped to the month's length (February, common and leap year)
assert.equal(dueDateForMonth('2026-03', 10), '2026-03-10');
assert.equal(dueDateForMonth('2026-02', 30), '2026-02-28'); // 2026 is not a leap year
assert.equal(dueDateForMonth('2028-02', 30), '2028-02-29'); // 2028 is a leap year
assert.equal(dueDateForMonth('2026-04'), '2026-04-10'); // default day
assert.throws(() => dueDateForMonth('2026/04', 10));

// Status: paid always wins this check first; overdue by date; pending right at the boundary (today == due date)
assert.equal(billStatus({ paid_at: '2026-03-01', due_date: '2020-01-01' }, '2026-03-10'), 'paid');
assert.equal(billStatus({ paid_at: null, due_date: '2026-03-09' }, '2026-03-10'), 'overdue');
assert.equal(billStatus({ paid_at: null, due_date: '2026-03-10' }, '2026-03-10'), 'pending');
assert.equal(billStatus({ paid_at: null, due_date: '2026-03-11' }, '2026-03-10'), 'pending');

// Generation from expenses: one bill per expense, amount and category inherited, no zero-amount bill
const expenses = [
  { _id: 'd1', school_id: 'e1', description: 'Segurança', category: 'Segurança', monthly_amount: 480, due_day: 5 },
  { _id: 'd2', school_id: 'e1', description: 'Internet', category: 'Internet', monthly_amount: 250 },
  { _id: 'd3', school_id: 'e1', description: 'Sem custo', category: 'Outros', monthly_amount: 0 },
];
const generated = generateMonthBills(expenses, '2026-10');
assert.equal(generated.length, 2);
assert.deepEqual(generated[0], { school_id: 'e1', expense_id: 'd1', description: 'Segurança', category: 'Segurança', period: '2026-10', due_date: '2026-10-05', amount: 480 });
assert.equal(generated[1].due_date, '2026-10-10'); // default day when the expense doesn't set one

// Due summary: separates overdue from upcoming, ignores paid ones, sums correctly
const bills = [
  { due_date: '2026-09-10', paid_at: null, amount: 100 },   // overdue (before today)
  { due_date: '2026-09-25', paid_at: null, amount: 200 },   // upcoming (within 7 days)
  { due_date: '2026-10-05', paid_at: null, amount: 300 },   // outside the window
  { due_date: '2026-09-10', paid_at: '2026-09-09', amount: 999 }, // paid: ignored even though overdue
];
const r = dueSummary(bills, '2026-09-22', 7);
assert.equal(r.overdue.length, 1);
assert.equal(r.totalOverdue, 100);
assert.equal(r.upcoming.length, 1);
assert.equal(r.totalUpcoming, 200);

console.log('ok bills');
