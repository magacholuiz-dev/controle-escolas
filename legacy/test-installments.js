import assert from 'node:assert/strict';
import { buildInstallments } from './installments.js';

const sum = (r) => Math.round(r.installments.reduce((s, x) => s + x.amount * 100, 0));

// R$ 2.000 in 3x by total: 666,67 + 666,67 + 666,66 — the leftover cent goes to the first ones, sum is exact.
const a = buildInstallments({ total: 2000, count: 3, firstDueDate: '2026-10-10' });
assert.deepEqual(a.installments.map((x) => x.amount), [666.67, 666.67, 666.66]);
assert.equal(sum(a), 200000);
assert.equal(a.total, 2000);

// Evenly divisible: R$ 3.000 in 3x is 3 x 1.000.
assert.deepEqual(buildInstallments({ total: 3000, count: 3, firstDueDate: '2026-10-10' }).installments.map((x) => x.amount), [1000, 1000, 1000]);

// By installment value: 10x of 340 = 3.400 total.
const b = buildInstallments({ installmentAmount: 340, count: 10, firstDueDate: '2026-01-15' });
assert.equal(b.installments.length, 10);
assert.ok(b.installments.every((x) => x.amount === 340));
assert.equal(b.total, 3400);

// Numbering and monthly due dates, crossing the year boundary; period follows the due date.
assert.deepEqual(a.installments.map((x) => [x.number, x.count, x.due_date, x.period]), [
  [1, 3, '2026-10-10', '2026-10'], [2, 3, '2026-11-10', '2026-11'], [3, 3, '2026-12-10', '2026-12'],
]);
assert.equal(b.installments[9].due_date, '2026-10-15');
assert.equal(buildInstallments({ total: 400, count: 4, firstDueDate: '2026-11-20' }).installments[3].due_date, '2027-02-20');

// A purchase due on the 31st clamps to the short month, then goes back to the 31st (no drift).
assert.deepEqual(buildInstallments({ installmentAmount: 10, count: 4, firstDueDate: '2026-01-31' }).installments.map((x) => x.due_date),
  ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
assert.equal(buildInstallments({ installmentAmount: 10, count: 2, firstDueDate: '2028-01-30' }).installments[1].due_date, '2028-02-29'); // leap year

// One installment is valid (a purchase paid at once).
assert.equal(buildInstallments({ total: 50, count: 1, firstDueDate: '2026-10-10' }).installments[0].amount, 50);

// Floating-point trap: 0.1 * 3 style values still add up to the cent.
assert.equal(sum(buildInstallments({ total: 100.1, count: 3, firstDueDate: '2026-10-10' })), 10010);

// Invalid input: never a silent guess.
const base = { count: 3, firstDueDate: '2026-10-10' };
assert.throws(() => buildInstallments({ ...base }), /total OU/); // neither
assert.throws(() => buildInstallments({ ...base, total: 100, installmentAmount: 30 }), /total OU/); // both
assert.throws(() => buildInstallments({ ...base, total: 0 }), /maior que zero/);
assert.throws(() => buildInstallments({ ...base, total: -5 }), /maior que zero/);
assert.throws(() => buildInstallments({ ...base, total: 'abc' }), /maior que zero/);
assert.throws(() => buildInstallments({ ...base, total: 100, count: 0 }), /parcelas/);
assert.throws(() => buildInstallments({ ...base, total: 100, count: 2.5 }), /parcelas/);
assert.throws(() => buildInstallments({ ...base, total: 100, count: 61 }), /parcelas/);
assert.throws(() => buildInstallments({ ...base, total: 100, firstDueDate: '2026-02-30' }), /calendário/);
assert.throws(() => buildInstallments({ ...base, total: 100, firstDueDate: '10/10/2026' }), /inválida/);
assert.throws(() => buildInstallments({ ...base, total: 0.02, count: 5 }), /pequeno demais/);

console.log('ok installments');
