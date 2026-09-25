import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo, cic;

before(async () => {
  api = await start();
  [novoMundo, cic] = await api.schools();
  await api.req('PUT', `/api/schools/${novoMundo.id}`, { tuition_due_day: 5 });
});
after(() => api.stop());

test('AC1: generating tuition creates one per active private-slot child and does not duplicate on repeat', async () => {
  await api.req('POST', '/api/children', { school_id: novoMundo.id, name: 'Ana', enrollment_type: 'private', tuition_amount: 800 });
  await api.req('POST', '/api/children', { school_id: novoMundo.id, name: 'Bia', enrollment_type: 'private', tuition_amount: 0 }); // no rate: doesn't generate one
  await api.req('POST', '/api/children', { school_id: novoMundo.id, name: 'Caio', enrollment_type: 'public' }); // public slot: doesn't generate one

  const g1 = await api.req('POST', '/api/tuition/generate', { school_id: novoMundo.id, period: '2026-10' });
  assert.equal(g1.status, 201);
  assert.equal(g1.body.created, 1);

  const g2 = await api.req('POST', '/api/tuition/generate', { school_id: novoMundo.id, period: '2026-10' });
  assert.equal(g2.body.created, 0, 'running it again does not duplicate');

  const list = (await api.req('GET', `/api/tuition?school_id=${novoMundo.id}&period=2026-10`)).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].due_date, '2026-10-05'); // the school's tuition_due_day
  assert.equal(list[0].base_amount, 800);
});

test('AC2: a discount reduces the charge, and it never goes negative', async () => {
  await api.req('POST', '/api/children', { school_id: cic.id, name: 'Duda', enrollment_type: 'private', tuition_amount: 800 });
  await api.req('POST', '/api/tuition/generate', { school_id: cic.id, period: '2026-11' });
  const t = (await api.req('GET', `/api/tuition?school_id=${cic.id}&period=2026-11`)).body[0];
  await api.req('PUT', `/api/tuition/${t.id}`, { discount: 100 });

  const paid = await api.req('POST', `/api/tuition/${t.id}/pay`, { paid_at: '2026-11-05' }); // no amount_paid: uses the charge (800-100)
  assert.equal(paid.status, 200);
  const entry = (await api.req('GET', `/api/entries?school_id=${cic.id}&year=2026`)).body.find((l) => l.id === paid.body.entry_id);
  assert.equal(entry.amount, 700);
  assert.equal(entry.type, 'revenue');
  assert.equal(entry.category, 'Mensalidades');
});

test('AC3: paying creates the entry; paying again returns 400; undoing removes it and allows paying again', async () => {
  const child = (await api.req('POST', '/api/children', { school_id: cic.id, name: 'Elis', enrollment_type: 'private', tuition_amount: 600 })).body;
  await api.req('POST', '/api/tuition/generate', { school_id: cic.id, period: '2026-12' });
  const t = (await api.req('GET', `/api/tuition?school_id=${cic.id}&period=2026-12`)).body.find((x) => x.child_id === child.id);

  const before = (await api.req('GET', `/api/entries?school_id=${cic.id}&year=2026`)).body.length;
  await api.req('POST', `/api/tuition/${t.id}/pay`, { amount_paid: 600, paid_at: '2026-12-05', payment_method: 'Pix' });
  assert.equal((await api.req('GET', `/api/entries?school_id=${cic.id}&year=2026`)).body.length, before + 1);

  const payAgain = await api.req('POST', `/api/tuition/${t.id}/pay`, { amount_paid: 600 });
  assert.equal(payAgain.status, 400);

  const undone = await api.req('POST', `/api/tuition/${t.id}/undo`);
  assert.equal(undone.status, 200);
  assert.equal((await api.req('GET', `/api/entries?school_id=${cic.id}&year=2026`)).body.length, before);

  const undoAgain = await api.req('POST', `/api/tuition/${t.id}/undo`);
  assert.equal(undoAgain.status, 400);
});

test('AC5 and AC6: the delinquency panel lists debtors with a billing message, with no CPF', async () => {
  await api.req('POST', '/api/children', { school_id: novoMundo.id, name: 'Fábio', enrollment_type: 'private', tuition_amount: 900, guardian_name: 'Sr. Fábio Pai', guardian_phone: '41999990000' });
  const child = (await api.req('GET', `/api/children?school_id=${novoMundo.id}`)).body.find((c) => c.name === 'Fábio');
  await api.req('POST', '/api/tuition', { school_id: novoMundo.id, child_id: child.id, period: '2025-01', base_amount: 900, due_date: '2025-01-10' });

  const panel = (await api.req('GET', '/api/tuition/panel?school=all')).body;
  assert.ok(panel.totalOverdue >= 900);
  const debtor = panel.debtors.find((d) => d.child === 'Fábio');
  assert.ok(debtor);
  assert.equal(debtor.bracket, '60+');
  assert.match(debtor.message, /Fábio/);
  assert.match(debtor.message, /Sr\. Fábio Pai/);
  assert.doesNotMatch(debtor.message, /\d{3}\.\d{3}\.\d{3}-\d{2}/); // never CPF
  assert.doesNotMatch(JSON.stringify(panel), /41999990000/); // nor the phone, which the panel doesn't ask for
});

test('AC7: generating with no private-slot children is not an error; invalid input returns 400', async () => {
  const emptySchool = (await api.req('POST', '/api/schools', { name: 'Escola sem crianças' })).body;
  const g = await api.req('POST', '/api/tuition/generate', { school_id: emptySchool.id, period: '2026-01' });
  assert.equal(g.status, 201);
  assert.equal(g.body.created, 0);

  const child = (await api.req('POST', '/api/children', { school_id: emptySchool.id, name: 'Gil', enrollment_type: 'private', tuition_amount: 500 })).body;
  const cases = [
    ['malformed period', () => api.req('POST', '/api/tuition/generate', { school_id: emptySchool.id, period: '2026/01' }), 400],
    ['nonexistent school when generating', () => api.req('POST', '/api/tuition/generate', { school_id: 'a'.repeat(24), period: '2026-01' }), 404],
    ['malformed due date', () => api.req('POST', '/api/tuition', { school_id: emptySchool.id, child_id: child.id, period: '2026-02', base_amount: 500, due_date: '02/2026' }), 400],
    ['nonexistent child', () => api.req('POST', '/api/tuition', { school_id: emptySchool.id, child_id: 'b'.repeat(24), period: '2026-02', base_amount: 500, due_date: '2026-02-10' }), 400],
    ['pay a nonexistent tuition charge', () => api.req('POST', `/api/tuition/${'c'.repeat(24)}/pay`, { amount_paid: 10 }), 404],
    ['undo a nonexistent tuition charge', () => api.req('POST', `/api/tuition/${'c'.repeat(24)}/undo`, {}), 404],
  ];
  for (const [name, run, expected] of cases) {
    const r = await run();
    assert.equal(r.status, expected, `${name}: expected ${expected}, got ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    assert.ok(r.body.error);
  }
});
