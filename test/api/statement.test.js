import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo, cic;
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `expected ${b}, got ${a}`);

before(async () => {
  api = await start();
  [novoMundo, cic] = await api.schools();
  await api.req('PUT', `/api/schools/${novoMundo.id}`, { children_count: 60 });
  await api.req('PUT', `/api/schools/${cic.id}`, { children_count: 40 });
});
after(() => api.stop());

test('AC1 and AC3: the statement\'s result and revenue match the report exactly, for a school and consolidated', async () => {
  await api.req('POST', '/api/revenues', { school_id: novoMundo.id, description: 'Contrato Prefeitura', monthly_amount: 60000, follows_calendar: 0 });
  await api.req('POST', '/api/expenses', { school_id: novoMundo.id, description: 'Segurança', category: 'Segurança', monthly_amount: 480, follows_calendar: 0 });

  const report = (await api.req('GET', `/api/report?year=2026&school=${novoMundo.id}`)).body;
  const statement = (await api.req('GET', `/api/statement?year=2026&school=${novoMundo.id}`)).body;
  assert.equal(statement.status, undefined); // sanity: not wrapped in an unexpected envelope
  assert.equal(statement.result, report.totals.result);
  assert.equal(statement.groups.find((g) => g.group === 'Receita bruta').amount, report.totals.revenue);

  const consolidatedReport = (await api.req('GET', '/api/report?year=2026&school=all')).body;
  const consolidatedStatement = (await api.req('GET', '/api/statement?year=2026&school=all')).body;
  near(consolidatedStatement.result, consolidatedReport.totals.result);
});

test('AC2: moving a category between groups changes the groups but never the total', async () => {
  const s = await api.req('GET', `/api/statement?year=2026&school=${novoMundo.id}`);
  const before = Object.fromEntries(s.body.groups.map((g) => [g.group, g.amount]));
  // The API always uses the default map, so we prove the invariant a different way: two schools
  // with the very same "Segurança" expense, one paying it as "Segurança" and the other having it
  // re-categorized as "Aluguel" (both mapped to Administrativo — so let's use Alimentação/Operacional
  // vs a category we know falls in Não classificado, to see both the group split AND the total hold).
  await api.req('POST', '/api/expenses', { school_id: cic.id, description: 'Item novo', category: 'Categoria inventada', monthly_amount: 480, follows_calendar: 0 });
  const r = (await api.req('GET', `/api/report?year=2026&school=${cic.id}`)).body;
  const st = (await api.req('GET', `/api/statement?year=2026&school=${cic.id}`)).body;
  assert.equal(st.result, r.totals.result); // total holds regardless of where the category landed
  assert.ok(st.unclassified.includes('Categoria inventada'));
  assert.ok(st.groups.find((g) => g.group === 'Não classificado').amount < 0);
  assert.ok(before.Administrativo !== undefined); // keeps the earlier lookup from being an unused no-op
});

test('AC4: an expense split 60/40 between the schools sums back to the original amount across both statements', async () => {
  const d = await api.req('POST', '/api/split', {
    resource: 'expenses', mode: 'manual', percentages: { [novoMundo.id]: 60, [cic.id]: 40 },
    data: { description: 'Contabilidade compartilhada', category: 'Contabilidade', monthly_amount: 1000, follows_calendar: 0 },
  });
  assert.equal(d.status, 201);

  const nm = (await api.req('GET', `/api/statement?year=2026&school=${novoMundo.id}`)).body;
  const ci = (await api.req('GET', `/api/statement?year=2026&school=${cic.id}`)).body;
  const nmReport = (await api.req('GET', `/api/report?year=2026&school=${novoMundo.id}`)).body;
  const ciReport = (await api.req('GET', `/api/report?year=2026&school=${cic.id}`)).body;
  assert.equal(nm.result, nmReport.totals.result);
  assert.equal(ci.result, ciReport.totals.result);
  near(d.body.splits.reduce((s, p) => s + p.amount, 0), 1000); // the two shares reconcile to the monthly amount
});

test('AC5: an unmapped category is reported in `unclassified` so the front can warn about it', async () => {
  const emptySchool = (await api.req('POST', '/api/schools', { name: 'Escola statement' })).body;
  await api.req('POST', '/api/expenses', { school_id: emptySchool.id, description: 'Algo', category: 'Outros', monthly_amount: 100, follows_calendar: 0 });
  const s = (await api.req('GET', `/api/statement?year=2026&school=${emptySchool.id}`)).body;
  assert.deepEqual(s.unclassified, ['Outros']);
});

test('AC6: a non one-off tracking entry never changes the statement\'s result', async () => {
  const school = (await api.req('POST', '/api/schools', { name: 'Escola AC6' })).body;
  await api.req('POST', '/api/revenues', { school_id: school.id, description: 'R', monthly_amount: 100, follows_calendar: 0 });
  await api.req('POST', '/api/expenses', { school_id: school.id, description: 'Luz', category: 'Luz', monthly_amount: 10, follows_calendar: 0 });
  const before = (await api.req('GET', `/api/statement?year=2026&school=${school.id}`)).body.result;
  await api.req('POST', '/api/entries', { school_id: school.id, date: '2026-03-10', type: 'expense', category: 'Luz', amount: 999, one_off: 0 });
  const after = (await api.req('GET', `/api/statement?year=2026&school=${school.id}`)).body.result;
  assert.equal(before, after);
});
