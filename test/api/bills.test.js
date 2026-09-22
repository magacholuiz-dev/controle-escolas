import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo, cic;
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `expected ${b}, got ${a}`);

before(async () => {
  api = await start();
  [novoMundo, cic] = await api.schools();
  await api.req('PUT', `/api/schools/${novoMundo.id}`, { children_count: 62 });
  await api.req('PUT', `/api/schools/${cic.id}`, { children_count: 48 });
});
after(() => api.stop());

test('AC1: generating the month\'s bills creates one per recurring expense and does not duplicate on repeat', async () => {
  await api.req('POST', '/api/expenses', { school_id: novoMundo.id, description: 'Segurança', category: 'Segurança', monthly_amount: 480, due_day: 5 });
  await api.req('POST', '/api/expenses', { school_id: novoMundo.id, description: 'Internet', category: 'Internet', monthly_amount: 250 });

  const g1 = await api.req('POST', '/api/bills/generate', { school_id: novoMundo.id, period: '2026-10' });
  assert.equal(g1.status, 201);
  assert.equal(g1.body.created, 2);

  const g2 = await api.req('POST', '/api/bills/generate', { school_id: novoMundo.id, period: '2026-10' });
  assert.equal(g2.body.created, 0, 'running it again does not duplicate');

  const list = (await api.req('GET', `/api/bills?school_id=${novoMundo.id}&period=2026-10`)).body;
  assert.equal(list.length, 2);
  const security = list.find((c) => c.description === 'Segurança');
  assert.equal(security.due_date, '2026-10-05');
  assert.equal(security.amount, 480);
});

test('AC2: overdue/pending/paid status is derived, never stored', async () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const overdue = (await api.req('POST', '/api/bills', { school_id: cic.id, description: 'Água', category: 'Água', period: '2026-09', due_date: yesterday, amount: 100 })).body;
  const pending = (await api.req('POST', '/api/bills', { school_id: cic.id, description: 'Luz', category: 'Luz', period: '2026-09', due_date: tomorrow, amount: 200 })).body;

  let list = (await api.req('GET', `/api/bills?school_id=${cic.id}`)).body;
  assert.equal(list.find((c) => c.id === overdue.id).status, 'overdue');
  assert.equal(list.find((c) => c.id === pending.id).status, 'pending');

  await api.req('POST', `/api/bills/${overdue.id}/pay`, { amount_paid: 100 });
  list = (await api.req('GET', `/api/bills?school_id=${cic.id}`)).body;
  assert.equal(list.find((c) => c.id === overdue.id).status, 'paid');
});

test('AC3: paying creates the entry and undoing removes it; the amount paid can differ from the planned one', async () => {
  const bill = (await api.req('POST', '/api/bills', { school_id: cic.id, description: 'Luz de outubro', category: 'Luz', period: '2026-10', due_date: '2026-10-08', amount: 250 })).body;

  const before = (await api.req('GET', `/api/entries?school_id=${cic.id}&year=2026`)).body.length;
  const paid = await api.req('POST', `/api/bills/${bill.id}/pay`, { amount_paid: 271.4, paid_at: '2026-10-07', payment_method: 'Pix' });
  assert.equal(paid.status, 200);

  const entries = (await api.req('GET', `/api/entries?school_id=${cic.id}&year=2026`)).body;
  assert.equal(entries.length, before + 1);
  const entry = entries.find((l) => l.id === paid.body.entry_id);
  assert.equal(entry.amount, 271.4, 'uses the amount paid, not the planned one');
  assert.equal(entry.category, 'Luz');

  const report = (await api.req('GET', `/api/report?year=2026&school=${cic.id}`)).body;
  const luz = report.categories.find((c) => c.category === 'Luz');
  assert.ok(luz.actual >= 271.4);

  const payAgain = await api.req('POST', `/api/bills/${bill.id}/pay`, { amount_paid: 100 });
  assert.equal(payAgain.status, 400, 'does not pay a bill that is already paid');

  const undone = await api.req('POST', `/api/bills/${bill.id}/undo`);
  assert.equal(undone.status, 200);
  assert.equal((await api.req('GET', `/api/entries?school_id=${cic.id}&year=2026`)).body.length, before);
  const billAfter = (await api.req('GET', `/api/bills?school_id=${cic.id}&period=2026-10`)).body.find((c) => c.id === bill.id);
  assert.equal(billAfter.status, 'pending');

  const undoAgain = await api.req('POST', `/api/bills/${bill.id}/undo`);
  assert.equal(undoAgain.status, 400, 'does not undo a bill that is not paid');
});

test('AC5: a bill split between the schools creates two linked bills; paying one does not pay the other', async () => {
  const d = await api.req('POST', '/api/split', {
    resource: 'bills', mode: 'children',
    data: { description: 'Vigilância', category: 'Segurança', period: '2026-11', due_date: '2026-11-10', amount: 480 },
  });
  assert.equal(d.status, 201);
  near(d.body.splits.reduce((s, p) => s + p.amount, 0), 480);

  const nm = (await api.req('GET', `/api/bills?school_id=${novoMundo.id}&period=2026-11`)).body;
  const ci = (await api.req('GET', `/api/bills?school_id=${cic.id}&period=2026-11`)).body;
  assert.equal(nm.length, 1);
  assert.equal(ci.length, 1);
  assert.equal(nm[0].group_id, ci[0].group_id);

  await api.req('POST', `/api/bills/${nm[0].id}/pay`, { amount_paid: nm[0].amount });
  const ciAfter = (await api.req('GET', `/api/bills?school_id=${cic.id}&period=2026-11`)).body[0];
  assert.equal(ciAfter.status, 'pending', 'paying Novo Mundo\'s bill does not pay CIC\'s');
});

test('AC6: the due-bills panel separates overdue from upcoming, with the school name', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const in3days = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  await api.req('POST', '/api/bills', { school_id: novoMundo.id, description: 'Vencida agora', category: 'Outros', period: '2026-09', due_date: today === '2026-09-22' ? '2026-09-15' : today, amount: 50 });
  await api.req('POST', '/api/bills', { school_id: novoMundo.id, description: 'Perto de vencer', category: 'Outros', period: '2026-09', due_date: in3days, amount: 60 });
  await api.req('POST', '/api/bills', { school_id: novoMundo.id, description: 'Longe', category: 'Outros', period: '2026-10', due_date: in30days, amount: 9999 });

  const panel = (await api.req('GET', '/api/bills/panel?school=all&days=7')).body;
  assert.ok(panel.overdue.some((c) => c.description === 'Vencida agora'));
  assert.ok(panel.upcoming.some((c) => c.description === 'Perto de vencer'));
  assert.ok(!panel.upcoming.some((c) => c.description === 'Longe'));
  assert.equal(panel.upcoming.find((c) => c.description === 'Perto de vencer').school, 'Novo Mundo');
});

test('AC7: negative amount, invalid due date and a nonexistent supplier return 400; a nonexistent id returns 404', async () => {
  const cases = [
    ['negative amount', () => api.req('POST', '/api/bills', { school_id: novoMundo.id, description: 'x', period: '2026-09', due_date: '2026-09-10', amount: -10 }), 400],
    ['zero amount', () => api.req('POST', '/api/bills', { school_id: novoMundo.id, description: 'x', period: '2026-09', due_date: '2026-09-10', amount: 0 }), 400],
    ['invalid due date', () => api.req('POST', '/api/bills', { school_id: novoMundo.id, description: 'x', period: '2026-09', due_date: '10/09/2026', amount: 10 }), 400],
    ['invalid period', () => api.req('POST', '/api/bills', { school_id: novoMundo.id, description: 'x', period: '2026/09', due_date: '2026-09-10', amount: 10 }), 400],
    ['nonexistent supplier', () => api.req('POST', '/api/bills', { school_id: novoMundo.id, supplier_id: 'b'.repeat(24), description: 'x', period: '2026-09', due_date: '2026-09-10', amount: 10 }), 400],
    ['generate with no period', () => api.req('POST', '/api/bills/generate', { school_id: novoMundo.id }), 400],
    ['pay a nonexistent bill', () => api.req('POST', `/api/bills/${'c'.repeat(24)}/pay`, { amount_paid: 10 }), 404],
    ['undo a nonexistent bill', () => api.req('POST', `/api/bills/${'c'.repeat(24)}/undo`, {}), 404],
    ['edit a nonexistent bill', () => api.req('PUT', `/api/bills/${'c'.repeat(24)}`, { amount: 10 }), 404],
    ['delete a nonexistent bill', () => api.req('DELETE', `/api/bills/${'c'.repeat(24)}`), 404],
    ['edit a nonexistent employee', () => api.req('PUT', `/api/employees/${'c'.repeat(24)}`, { name: 'x' }), 404],
  ];
  for (const [name, run, expected] of cases) {
    const r = await run();
    assert.equal(r.status, expected, `${name}: expected ${expected}, got ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    assert.ok(r.body.error, `${name}: should carry an error message`);
  }
});
