import { test } from 'vitest';
import assert from 'node:assert/strict';
import { calculateCharge, tuitionDueDateForMonth as dueDateForMonth, generateMonthTuition, overdueBracket, delinquency, chargeMessage } from '../src/tuition';

test('tuition: legacy assertions, ported 1:1', () => {

  // AC2: simple discount, and a discount bigger than the amount never goes negative
  assert.equal(calculateCharge(800, 100), 700);
  assert.equal(calculateCharge(800, 0), 800);
  assert.equal(calculateCharge(800, 900), 0);
  assert.equal(calculateCharge(800, -50), 850); // a negative "discount" = manual surcharge, documented advanced use

  assert.equal(dueDateForMonth('2026-02', 30), '2026-02-28');
  assert.throws(() => dueDateForMonth('2026/02', 10));

  // AC1: only private-slot children active in the period generate a tuition charge
  const children = [
    { _id: 'p1', school_id: 'e1', enrollment_type: 'private', tuition_amount: 800 },
    { _id: 'p2', school_id: 'e1', enrollment_type: 'private', tuition_amount: 0 },              // no rate: doesn't generate one
    { _id: 'p3', school_id: 'e1', enrollment_type: 'private', tuition_amount: 500, exit_date: '2026-08-31' }, // left before September
    { _id: 'g1', school_id: 'e1', enrollment_type: 'public', tuition_amount: 800 },              // public slot: doesn't generate one
  ];
  const generated = generateMonthTuition(children, '2026-09', 15);
  assert.equal(generated.length, 1);
  assert.deepEqual(generated[0], { school_id: 'e1', child_id: 'p1', period: '2026-09', base_amount: 800, discount: 0, due_date: '2026-09-15' });

  // AC4: overdue brackets at the exact boundaries
  assert.equal(overdueBracket('2026-09-10', '2026-09-10'), 'current'); // due today
  assert.equal(overdueBracket('2026-09-10', '2026-09-09'), 'current'); // not due yet
  assert.equal(overdueBracket('2026-08-11', '2026-09-10'), '1-30');    // exactly 30 days
  assert.equal(overdueBracket('2026-08-10', '2026-09-10'), '31-60');   // exactly 31 days
  assert.equal(overdueBracket('2026-07-12', '2026-09-10'), '31-60');   // exactly 60 days: still 31-60
  assert.equal(overdueBracket('2026-07-11', '2026-09-10'), '60+');     // 61 days: already 60+
  assert.equal(overdueBracket('2026-01-01', '2026-09-10'), '60+');     // well overdue
  assert.equal(overdueBracket('2020-01-01', '2026-09-10', true), 'current'); // paid is never overdue

  // AC5: delinquency = overdue / everything already due
  const today = '2026-09-10';
  const charges = [
    { base_amount: 800, discount: 0, due_date: '2026-08-10', paid_at: null },   // due, unpaid: 800 overdue
    { base_amount: 700, discount: 0, due_date: '2026-08-10', paid_at: '2026-08-09' }, // due, paid: doesn't count as overdue
    { base_amount: 500, discount: 0, due_date: '2026-09-20', paid_at: null },   // not due yet: outside the denominator
  ];
  const d = delinquency(charges, today);
  assert.equal(d.totalDue, 1500);
  assert.equal(d.totalOverdue, 800);
  assert.equal(d.pct, 800 / 1500);
  assert.equal(delinquency([], today).pct, null); // nothing due yet, never divides by zero

  // AC6: billing message with no CPF, with guardian, month and amount
  const msg = chargeMessage(
    { period: '2026-09', base_amount: 800, discount: 100, due_date: '2026-09-15' },
    { name: 'Ana', guardian_name: 'Maria', cpf: '000.000.000-00' },
    'Novo Mundo',
  );
  assert.match(msg, /Maria/);
  assert.match(msg, /Ana/);
  assert.match(msg, /setembro\/2026/);
  assert.match(msg, /R\$\s?700,00/);
  assert.doesNotMatch(msg, /000\.000\.000-00/);


});
