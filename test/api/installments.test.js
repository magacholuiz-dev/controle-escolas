import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo, cic;

before(async () => {
  api = await start();
  [novoMundo, cic] = await api.schools();
});
after(() => api.stop());

const list = async (school) => (await api.req('GET', `/api/bills?school_id=${school.id}`)).body;
const post = (body, opts) => api.req('POST', '/api/bills/installments', { school_id: novoMundo.id, description: 'Geladeira', category: 'Manutenção', first_due_date: '2026-10-10', ...body }, opts);

test('AC1: R$ 2.000 in 3x creates 3 monthly bills that add up to exactly R$ 2.000', async () => {
  const r = await post({ total_amount: 2000, count: 3 });
  assert.equal(r.status, 201);
  assert.equal(r.body.count, 3);
  assert.equal(r.body.total, 2000);
  const bills = (await list(novoMundo)).filter((b) => b.installment_group_id === r.body.installment_group_id).sort((a, b) => a.installment_no - b.installment_no);
  assert.deepEqual(bills.map((b) => b.amount), [666.67, 666.67, 666.66]);
  assert.deepEqual(bills.map((b) => b.due_date), ['2026-10-10', '2026-11-10', '2026-12-10']);
  assert.deepEqual(bills.map((b) => [b.installment_no, b.installment_count]), [[1, 3], [2, 3], [3, 3]]);
  assert.deepEqual(bills.map((b) => b.period), ['2026-10', '2026-11', '2026-12']);
  assert.equal(Math.round(bills.reduce((s, b) => s + b.amount * 100, 0)), 200000);
});

test('AC2: 10x of R$ 340 (by installment value) creates 10 bills of exactly 340', async () => {
  const r = await post({ installment_amount: 340, count: 10, description: 'Ar-condicionado' });
  assert.equal(r.body.total, 3400);
  const bills = (await list(novoMundo)).filter((b) => b.installment_group_id === r.body.installment_group_id);
  assert.equal(bills.length, 10);
  assert.ok(bills.every((b) => b.amount === 340));
});

test('AC3: paying one installment pays only that one and creates a single entry', async () => {
  const r = await post({ total_amount: 300, count: 3, description: 'Mesas' });
  const [first, second] = (await list(novoMundo)).filter((b) => b.installment_group_id === r.body.installment_group_id).sort((a, b) => a.installment_no - b.installment_no);
  const entriesBefore = (await api.req('GET', `/api/entries?school_id=${novoMundo.id}`)).body.length;
  const paid = await api.req('POST', `/api/bills/${first.id}/pay`, {});
  assert.equal(paid.status, 200);
  assert.equal((await api.req('GET', `/api/entries?school_id=${novoMundo.id}`)).body.length, entriesBefore + 1);
  const after = (await list(novoMundo)).filter((b) => b.installment_group_id === r.body.installment_group_id);
  assert.equal(after.filter((b) => b.status === 'paid').length, 1);
  assert.equal(after.find((b) => b.id === second.id).status !== 'paid', true);
});

test('AC4: removing the purchase deletes only the unpaid installments and keeps the paid one', async () => {
  const r = await post({ total_amount: 400, count: 4, description: 'Estantes' });
  const bills = (await list(novoMundo)).filter((b) => b.installment_group_id === r.body.installment_group_id).sort((a, b) => a.installment_no - b.installment_no);
  await api.req('POST', `/api/bills/${bills[0].id}/pay`, {});
  const del = await api.req('DELETE', `/api/bills/${bills[1].id}?installments=1`);
  assert.equal(del.status, 200);
  assert.equal(del.body.removed, 3);
  const left = (await list(novoMundo)).filter((b) => b.installment_group_id === r.body.installment_group_id);
  assert.equal(left.length, 1);
  assert.equal(left[0].status, 'paid');
});

test('AC5: the purchase is logged in the audit log with who, what and how many installments', async () => {
  const r = await post({ total_amount: 90, count: 3, description: 'Cadeiras' });
  const log = (await api.req('GET', `/api/audit?school_id=${novoMundo.id}`)).body;
  const entry = log.find((a) => a.action === 'bills.installments' && a.after.description === 'Cadeiras');
  assert.ok(entry);
  assert.equal(entry.after.parcelas, 3);
  assert.equal(entry.after.total, 90);
  assert.equal(r.status, 201);
});

test('AC6: invalid input returns 400 and creates nothing; a director cannot buy for the other school', async () => {
  const before = (await list(novoMundo)).length;
  const cases = [
    ['neither total nor installment', { count: 3 }],
    ['both total and installment', { total_amount: 100, installment_amount: 30, count: 3 }],
    ['zero installments', { total_amount: 100, count: 0 }],
    ['61 installments', { total_amount: 100, count: 61 }],
    ['negative value', { total_amount: -10, count: 2 }],
    ['impossible date', { total_amount: 100, count: 2, first_due_date: '2026-02-30' }],
    ['blank description', { total_amount: 100, count: 2, description: '  ' }],
    ['unknown supplier', { total_amount: 100, count: 2, supplier_id: '6ab2e08b6dce41df032284ff' }],
    ['bad school', { total_amount: 100, count: 2, school_id: 'xyz' }],
  ];
  for (const [name, body] of cases) {
    const r = await post(body);
    assert.equal(r.status, 400, `${name}: expected 400, got ${r.status} ${JSON.stringify(r.body)}`);
  }
  assert.equal((await list(novoMundo)).length, before);

  await api.req('POST', '/api/users', { email: 'dir.cic@test.local', password: 'director-password', role: 'director', school_ids: [cic.id] });
  const cookie = await api.loginAs('dir.cic@test.local', 'director-password');
  assert.equal((await post({ total_amount: 100, count: 2 }, { cookie })).status, 403);
  assert.equal((await post({ total_amount: 100, count: 2, school_id: cic.id }, { cookie })).status, 201);
});
