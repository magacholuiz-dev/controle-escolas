import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo, cic;

before(async () => {
  api = await start();
  [novoMundo, cic] = await api.schools();
});
after(() => api.stop());

test('AC1: cost and revenue per child match the report by hand, for a single school', async () => {
  await api.req('POST', '/api/revenues', { school_id: novoMundo.id, description: 'Contrato Prefeitura', monthly_amount: 60000, follows_calendar: 0 });
  await api.req('POST', '/api/children', { school_id: novoMundo.id, name: 'Ana', enrollment_type: 'private', tuition_amount: 800 });
  await api.req('POST', '/api/children', { school_id: novoMundo.id, name: 'Bia', enrollment_type: 'private', tuition_amount: 800 });

  const report = (await api.req('GET', `/api/report?year=2026&school=${novoMundo.id}`)).body;
  const m = (await api.req('GET', `/api/metrics?year=2026&school=${novoMundo.id}`)).body;
  assert.equal(m.activeChildren, 2);
  assert.equal(m.costPerChild, report.totals.accrualCost / 2);
  assert.equal(m.revenuePerChild, report.totals.revenue / 2);
});

test('AC3: a school with no children returns null ratios, never NaN/Infinity', async () => {
  const empty = (await api.req('POST', '/api/schools', { name: 'Escola vazia' })).body;
  await api.req('POST', '/api/revenues', { school_id: empty.id, description: 'R', monthly_amount: 1000, follows_calendar: 0 });
  const m = (await api.req('GET', `/api/metrics?year=2026&school=${empty.id}`)).body;
  for (const key of ['costPerChild', 'revenuePerChild', 'variableCostPerChild', 'breakEven']) {
    assert.equal(m[key], null, `${key} should be null`);
    assert.notEqual(String(m[key]), 'NaN');
  }
});

test('AC5: payroll over revenue is null with zero revenue', async () => {
  const noRevenueSchool = (await api.req('POST', '/api/schools', { name: 'Sem receita' })).body;
  await api.req('POST', '/api/employees', { school_id: noRevenueSchool.id, name: 'Prof', salary: 3000 });
  const m = (await api.req('GET', `/api/metrics?year=2026&school=${noRevenueSchool.id}`)).body;
  assert.equal(m.payrollOverRevenue, null);
});

test('AC6: the consolidated comparison marks the winning school per row', async () => {
  // Novo Mundo: cheap and few children (low cost/child); CIC: pricier per child on purpose.
  await api.req('POST', '/api/expenses', { school_id: cic.id, description: 'Aluguel caro', category: 'Aluguel', monthly_amount: 50000, follows_calendar: 0 });
  await api.req('POST', '/api/revenues', { school_id: cic.id, description: 'R', monthly_amount: 1000, follows_calendar: 0 });
  await api.req('POST', '/api/children', { school_id: cic.id, name: 'Caio', enrollment_type: 'private', tuition_amount: 500 });

  const all = (await api.req('GET', '/api/metrics?year=2026&school=all')).body;
  assert.ok(all.schools.length >= 2); // includes the schools created in earlier tests of this same file
  const nm = all.schools.find((s) => s.name === 'Novo Mundo');
  const ci = all.schools.find((s) => s.name === 'CIC');
  assert.ok(nm.costPerChild < ci.costPerChild);
  assert.equal(all.winners.costPerChild, nm.id, 'lower cost per child should win that row');
  assert.ok(all.consolidated.activeChildren >= nm.activeChildren + ci.activeChildren);
});

test('AC2 (API smoke test): break-even is either null or a positive integer, never a fraction', async () => {
  const m = (await api.req('GET', `/api/metrics?year=2026&school=${novoMundo.id}`)).body;
  if (m.breakEven != null) assert.equal(m.breakEven, Math.round(m.breakEven));
});
