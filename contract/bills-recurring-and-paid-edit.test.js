// Recurring monthly debits, and editing/deleting bills that were already paid (their ledger entry follows).
// New behavior of the Nest API only: skipped when the suite runs against the legacy server.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

const isNest = (process.env.API_CMD || '').includes('apps/api');
let api, school;
before(async () => { if (!isNest) return; api = await start(); school = (await api.schools())[0].id; });
after(async () => { await api?.stop(); });
const skip = !isNest && 'Nest-only behavior';

test('recurring debit: one bill per month, due on the chosen day, plus the recurring expense', { skip }, async () => {
  const r = await api.req('POST', '/api/bills/recurring', { school_id: school, description: 'Aluguel', category: 'Aluguel', amount: 4400, due_day: 28, from_period: '2026-11', to_period: '2027-02' });
  assert.equal(r.status, 201);
  assert.equal(r.body.created, 4);
  const bills = (await api.req('GET', `/api/bills?school_id=${school}`)).body.filter((b) => b.description === 'Aluguel');
  assert.deepEqual(bills.map((b) => [b.period, b.due_date, b.amount]), [['2026-11', '2026-11-28', 4400], ['2026-12', '2026-12-28', 4400], ['2027-01', '2027-01-28', 4400], ['2027-02', '2027-02-28', 4400]]);
  const exp = (await api.req('GET', `/api/expenses?school_id=${school}`)).body.find((e) => e.description === 'Aluguel');
  assert.equal(exp.monthly_amount, 4400);
  assert.equal(exp.due_day, 28);
});

test('recurring debit rejects bad input', { skip }, async () => {
  const base = { school_id: school, description: 'X', amount: 10, due_day: 5, from_period: '2026-01', to_period: '2026-03' };
  for (const bad of [{ amount: 0 }, { due_day: 31 }, { description: ' ' }, { to_period: '2025-12' }, { from_period: '2026-13' }, { to_period: '2036-01' }]) {
    assert.equal((await api.req('POST', '/api/bills/recurring', { ...base, ...bad })).status, 400, JSON.stringify(bad));
  }
});

test('ending a recurrence removes the unpaid bills and the expense, and keeps the paid ones', { skip }, async () => {
  await api.req('POST', '/api/bills/recurring', { school_id: school, description: 'Segurança', category: 'Segurança', amount: 900, due_day: 5, from_period: '2026-01', to_period: '2026-04' });
  const list = () => api.req('GET', `/api/bills?school_id=${school}`).then((r) => r.body.filter((b) => b.description === 'Segurança'));
  const [first] = await list();
  await api.req('POST', `/api/bills/${first.id}/pay`, { amount_paid: 900, paid_at: '2026-01-05' });
  const r = await api.req('DELETE', `/api/bills/recurring/${first.expense_id}`);
  assert.equal(r.body.removed, 3);
  const left = await list();
  assert.equal(left.length, 1);
  assert.equal(left[0].status, 'paid');
  assert.equal((await api.req('GET', `/api/expenses?school_id=${school}`)).body.some((e) => e.description === 'Segurança'), false);
});

test('a paid bill can be corrected and its ledger entry follows', { skip }, async () => {
  const { body: made } = await api.req('POST', '/api/bills', { school_id: school, description: 'Água', category: 'Água', period: '2026-08', due_date: '2026-08-10', amount: 120 });
  await api.req('POST', `/api/bills/${made.id}/pay`, { amount_paid: 120, paid_at: '2026-08-09' });
  const entry = async () => (await api.req('GET', `/api/entries?school_id=${school}&year=2026`)).body.find((e) => e.bill_id === made.id || (e.description === 'Água' && e.type === 'expense'));
  assert.equal((await api.req('PUT', `/api/bills/${made.id}`, { amount_paid: 131.5, paid_at: '2026-08-11', category: 'Luz' })).status, 200);
  const e = await entry();
  assert.deepEqual([e.amount, e.date, e.category], [131.5, '2026-08-11', 'Luz']);
  assert.equal((await api.req('PUT', `/api/bills/${made.id}`, { amount_paid: 0 })).status, 400);
  assert.equal((await api.req('PUT', `/api/bills/${made.id}`, { paid_at: '11/08/2026' })).status, 400);
});

test('paid fields cannot be set on a bill that is not paid', { skip }, async () => {
  const { body: open } = await api.req('POST', '/api/bills', { school_id: school, description: 'Luz', category: 'Luz', period: '2026-09', due_date: '2026-09-10', amount: 300 });
  assert.equal((await api.req('PUT', `/api/bills/${open.id}`, { paid_at: '2026-09-09', amount_paid: 300 })).status, 400);
  assert.equal((await api.req('POST', '/api/bills', { school_id: school, description: 'Fraude', period: '2026-09', due_date: '2026-09-10', amount: 1, paid_at: '2026-09-01' })).status, 201);
  const created = (await api.req('GET', `/api/bills?school_id=${school}`)).body.find((b) => b.description === 'Fraude');
  assert.equal(created.paid_at ?? null, null, 'paid_at is ignored on create');
});

test('deleting a paid bill also removes the expense it posted', { skip }, async () => {
  const { body: made } = await api.req('POST', '/api/bills', { school_id: school, description: 'Internet', category: 'Internet', period: '2026-09', due_date: '2026-09-15', amount: 200 });
  await api.req('POST', `/api/bills/${made.id}/pay`, { amount_paid: 200, paid_at: '2026-09-14' });
  const count = async () => (await api.req('GET', `/api/entries?school_id=${school}&year=2026`)).body.filter((e) => e.description === 'Internet').length;
  assert.equal(await count(), 1);
  assert.equal((await api.req('DELETE', `/api/bills/${made.id}`)).status, 200);
  assert.equal(await count(), 0);
});
