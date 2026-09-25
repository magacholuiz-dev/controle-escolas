import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo;

before(async () => {
  api = await start();
  [novoMundo] = await api.schools();
  await api.req('POST', '/api/revenues', { school_id: novoMundo.id, description: 'Contrato Prefeitura', monthly_amount: 60000, follows_calendar: 0 });
});
after(() => api.stop());

test('AC1: delaying the transfer 2 months keeps the annual profit and worsens (or holds) the minimum balance', async () => {
  const r = await api.req('POST', '/api/scenarios/simulate', { school_id: novoMundo.id, year: 2026, adjustments: [{ type: 'delay_transfer', months: 2 }] });
  assert.equal(r.status, 200);
  assert.equal(r.body.scenario.result, r.body.base.result);
  assert.ok(r.body.scenario.minBalance <= r.body.base.minBalance);
});

test('AC2: an empty adjustment list returns exactly the base scenario', async () => {
  const r = await api.req('POST', '/api/scenarios/simulate', { school_id: novoMundo.id, year: 2026, adjustments: [] });
  assert.deepEqual(r.body.scenario, r.body.base);
  assert.deepEqual(r.body.warnings, []);
});

test('AC3: simulating a termination changes the scenario\'s cost without touching the real employee', async () => {
  const e = (await api.req('POST', '/api/employees', { school_id: novoMundo.id, name: 'Simulado', salary: 3000, hire_date: '2023-01-10' })).body;
  const r = await api.req('POST', '/api/scenarios/simulate', { school_id: novoMundo.id, year: 2026, adjustments: [{ type: 'terminate', employee_id: e.id, date: '2026-06-15' }] });
  assert.notEqual(r.body.scenario.result, r.body.base.result);

  const employeeAfter = (await api.req('GET', `/api/employees?school_id=${novoMundo.id}`)).body.find((x) => x.id === e.id);
  assert.equal(employeeAfter.active, 1); // the real employee was never touched
  assert.equal(employeeAfter.termination_date, null);
});

test('AC4: creating, listing and deleting a scenario never changes any other collection\'s count', async () => {
  const before = {
    employees: (await api.req('GET', `/api/employees?school_id=${novoMundo.id}`)).body.length,
    revenues: (await api.req('GET', `/api/revenues?school_id=${novoMundo.id}`)).body.length,
    entries: (await api.req('GET', `/api/entries?school_id=${novoMundo.id}&year=2026`)).body.length,
  };
  const created = await api.req('POST', '/api/scenarios', { school_id: novoMundo.id, name: 'Atraso de 2 meses', adjustments: [{ type: 'delay_transfer', months: 2 }] });
  assert.equal(created.status, 201);
  const list = (await api.req('GET', `/api/scenarios?school_id=${novoMundo.id}`)).body;
  assert.ok(list.some((s) => s.id === created.body.id));
  await api.req('DELETE', `/api/scenarios/${created.body.id}`);

  const after = {
    employees: (await api.req('GET', `/api/employees?school_id=${novoMundo.id}`)).body.length,
    revenues: (await api.req('GET', `/api/revenues?school_id=${novoMundo.id}`)).body.length,
    entries: (await api.req('GET', `/api/entries?school_id=${novoMundo.id}&year=2026`)).body.length,
  };
  assert.deepEqual(after, before);
  assert.equal((await api.req('GET', `/api/scenarios?school_id=${novoMundo.id}`)).body.some((s) => s.id === created.body.id), false);
});

test('AC6: bad adjustments come back as warnings, never a 500', async () => {
  const r = await api.req('POST', '/api/scenarios/simulate', {
    school_id: novoMundo.id, year: 2026,
    adjustments: [{ type: 'made_up' }, { type: 'terminate', employee_id: 'a'.repeat(24), date: '2026-01-01' }, { type: 'cut_expense', category: 'Alimentação', pct: 9 }],
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.warnings.length, 3);
});

test('AC6: invalid input at the endpoint level (bad school, bad year, non-array adjustments) returns 400/404', async () => {
  const cases = [
    ['missing school', () => api.req('POST', '/api/scenarios/simulate', { school_id: 'a'.repeat(24), year: 2026, adjustments: [] }), 404],
    ['malformed school id', () => api.req('POST', '/api/scenarios/simulate', { school_id: 'xyz', year: 2026, adjustments: [] }), 400],
    ['bad year', () => api.req('POST', '/api/scenarios/simulate', { school_id: novoMundo.id, year: 'abc', adjustments: [] }), 400],
    ['adjustments not an array', () => api.req('POST', '/api/scenarios/simulate', { school_id: novoMundo.id, year: 2026, adjustments: 'nope' }), 400],
  ];
  for (const [name, run, expected] of cases) {
    const r = await run();
    assert.equal(r.status, expected, `${name}: expected ${expected}, got ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    assert.ok(r.body.error);
  }
});
