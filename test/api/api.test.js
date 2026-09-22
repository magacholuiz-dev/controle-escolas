import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo, cic;
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `expected ${b}, got ${a}`);

before(async () => {
  api = await start();
  [novoMundo, cic] = await api.schools();
});
after(() => api.stop());

test('AC1: the consolidated report returns 12 months and respects the city-hall transfer', async () => {
  await api.req('POST', '/api/revenues', { school_id: novoMundo.id, description: 'Contrato Prefeitura', monthly_amount: 60000, follows_calendar: 1 });
  const r = await api.req('GET', '/api/report?year=2026&school=all');
  assert.equal(r.status, 200);
  assert.equal(r.body.months.length, 12);
  assert.ok(r.body.totals.revenue > 0);
  assert.equal(r.body.months[0].revenue, 0, 'January: the city hall does not pay');
  assert.equal(r.body.months[1].revenue, 30000, 'February: half');
  assert.equal(r.body.months[2].revenue, 60000);
  assert.equal(r.body.months[6].revenue, 0, 'July: the city hall does not pay');
});

test('AC2 and AC3: splitting by children creates two linked entries and deleting the group removes both', async () => {
  await api.req('PUT', `/api/schools/${novoMundo.id}`, { children_count: 62 });
  await api.req('PUT', `/api/schools/${cic.id}`, { children_count: 48 });
  const d = await api.req('POST', '/api/split', {
    resource: 'entries', mode: 'children',
    data: { date: '2026-03-12', type: 'expense', category: 'Material de cozinha', description: 'Panelas', amount: 1850, one_off: 1 },
  });
  assert.equal(d.status, 201);
  const [a, b] = d.body.splits;
  near(a.amount + b.amount, 1850);
  assert.equal(a.amount, 1042.73);
  assert.equal(b.amount, 807.27);

  const nm = (await api.req('GET', `/api/entries?school_id=${novoMundo.id}&year=2026`)).body;
  const ci = (await api.req('GET', `/api/entries?school_id=${cic.id}&year=2026`)).body;
  assert.equal(nm.length, 1);
  assert.equal(ci.length, 1);
  assert.equal(nm[0].group_id, ci[0].group_id);
  assert.equal(nm[0].total_amount, 1850);

  const del = await api.req('DELETE', `/api/entries/${nm[0].id}?group=1`);
  assert.equal(del.body.removed, 2);
  assert.equal((await api.req('GET', `/api/entries?school_id=${cic.id}&year=2026`)).body.length, 0);
});

test('AC4 and AC5: severance matches the hand calculation, and applying it terminates the employee and posts the cost', async () => {
  const e = (await api.req('POST', '/api/employees', {
    school_id: cic.id, name: 'Teste Silva', salary: 3000, hire_date: '2023-03-10', vacation_periods_taken: 3,
  })).body;
  const q = `employee_id=${e.id}&date=2026-09-18&type=without_cause`;

  const r = await api.req('GET', `/api/severance?${q}`);
  assert.equal(r.status, 200);
  near(r.body.totalToEmployee, 10866.67);
  near(r.body.schoolCost, 16153.07);

  const before = (await api.req('GET', `/api/report?year=2026&school=${cic.id}`)).body.months[8].cashOut;
  const applied = await api.req('POST', '/api/severance', { employee_id: e.id, date: '2026-09-18', type: 'without_cause', notice: 'paid_in_lieu', notice_worked: '1' });
  assert.equal(applied.status, 201);

  const employee = (await api.req('GET', `/api/employees?school_id=${cic.id}`)).body.find((x) => x.id === e.id);
  assert.equal(employee.active, 0);
  assert.equal(employee.termination_date, '2026-09-18');

  const entries = (await api.req('GET', `/api/entries?school_id=${cic.id}&year=2026`)).body;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].category, 'Rescisão');
  assert.equal(entries[0].one_off, 1);
  near(entries[0].amount, 16153.07);

  const after = (await api.req('GET', `/api/report?year=2026&school=${cic.id}`)).body.months[8].cashOut;
  near(after - before, 16153.07); // September's salary keeps going; only the severance adds on top
});

test('AC7: invalid input returns 4xx with a message, never 500', async () => {
  const withHire = (await api.req('POST', '/api/employees', { school_id: novoMundo.id, name: 'Com admissão', salary: 2000, hire_date: '2024-01-10' })).body;
  const noHire = (await api.req('POST', '/api/employees', { school_id: novoMundo.id, name: 'Sem admissão', salary: 2000 })).body;
  const cases = [
    ['non-numeric year', () => api.req('GET', '/api/report?year=abc&school=all'), 400],
    ['year out of range', () => api.req('GET', '/api/report?year=1800&school=all'), 400],
    ['invalid school', () => api.req('GET', '/api/report?year=2026&school=xyz'), 400],
    ['malformed id on PUT', () => api.req('PUT', '/api/employees/xyz', { name: 'x' }), 400],
    ['malformed id on DELETE', () => api.req('DELETE', '/api/revenues/123'), 400],
    ['broken JSON', () => api.req('POST', '/api/revenues', '{not json', { raw: true }), 400],
    ['body that is not an object', () => api.req('POST', '/api/revenues', '[1,2]', { raw: true }), 400],
    ['number where a string/amount was expected', () => api.req('POST', '/api/revenues', { school_id: novoMundo.id, description: 'x', monthly_amount: 'abc' }), 400],
    ['month 13 in the calendar', () => api.req('PUT', `/api/calendar?school_id=${novoMundo.id}&year=2026`, { month: 13, factor: 1 }), 400],
    ['factor above 1', () => api.req('PUT', `/api/calendar?school_id=${novoMundo.id}&year=2026`, { month: 3, factor: 5 }), 400],
    ['severance for a nonexistent employee', () => api.req('GET', `/api/severance?employee_id=${'a'.repeat(24)}&date=2026-09-18&type=mutual_agreement`), 404],
    ['severance with an invalid date', () => api.req('GET', `/api/severance?employee_id=${withHire.id}&date=today&type=mutual_agreement`), 400],
    ['severance before the hire date', () => api.req('GET', `/api/severance?employee_id=${withHire.id}&date=2020-01-01&type=mutual_agreement`), 400],
    ['severance with an invalid type', () => api.req('GET', `/api/severance?employee_id=${withHire.id}&date=2026-09-18&type=made_up`), 400],
    ['severance for an employee with no hire date', () => api.req('GET', `/api/severance?employee_id=${noHire.id}&date=2026-09-18&type=mutual_agreement`), 400],
    ['manual split that does not add up to 100', () => api.req('POST', '/api/split', { resource: 'entries', mode: 'manual', percentages: { [novoMundo.id]: 70, [cic.id]: 20 }, data: { date: '2026-01-01', type: 'expense', amount: 100 } }), 400],
    ['split of a disallowed resource', () => api.req('POST', '/api/split', { resource: 'schools', mode: 'equal', data: { amount: 1 } }), 400],
    ['expense with no description', () => api.req('POST', '/api/expenses', { school_id: novoMundo.id, monthly_amount: 10 }), 400],
    ['nonexistent resource', () => api.req('GET', '/api/doesnotexist'), 404],
    ['delete a school', () => api.req('DELETE', `/api/schools/${novoMundo.id}`), 400],
    ['oversized body', () => api.req('POST', '/api/revenues', { school_id: novoMundo.id, description: 'x'.repeat(1.2 * 1024 * 1024) }), 413],
  ];
  for (const [name, run, expected] of cases) {
    const r = await run();
    assert.equal(r.status, expected, `${name}: expected ${expected}, got ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    assert.ok(r.body.error, `${name}: should carry an error message`);
    assert.ok(!/Path `|validation failed|Cast to/i.test(r.body.error), `${name}: a technical message leaked: ${r.body.error}`);
  }
  const noDescription = await api.req('POST', '/api/expenses', { school_id: novoMundo.id, monthly_amount: 10 });
  assert.equal(noDescription.body.error, 'Preencha o campo "descrição".');
});

test('AC7: a path with ".." never serves files outside public/', async () => {
  for (const path of ['/../server.js', '/..%2fserver.js', '/%2e%2e/db.js']) {
    const r = await api.req('GET', path);
    assert.ok(r.status >= 400 && r.status < 500, `${path} returned ${r.status}`);
    assert.ok(!String(r.body).includes('mongoose'), `${path} leaked source code`);
  }
});
