import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo;
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `expected ${b}, got ${a}`);

before(async () => {
  api = await start();
  [novoMundo] = await api.schools();
});
after(() => api.stop());

test('AC5: with nothing wrong, the alerts endpoint returns an empty array', async () => {
  const empty = (await api.req('POST', '/api/schools', { name: 'Escola tranquila' })).body;
  const r = await api.req('GET', `/api/alerts?year=2026&school_id=${empty.id}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, []);
});

test('AC1: an employee 45 days from the vacation deadline triggers an alert', async () => {
  // Deadline = hire_date + 24 months (0 periods taken). Pick a hire_date so "today" (real date) sits 45 days before it.
  const today = new Date();
  const deadline = new Date(today.getTime() + 45 * 86400000);
  const hireDate = new Date(deadline); hireDate.setUTCMonth(hireDate.getUTCMonth() - 24);
  const iso = (d) => d.toISOString().slice(0, 10);
  await api.req('POST', '/api/employees', { school_id: novoMundo.id, name: 'Vencendo', salary: 2000, hire_date: iso(hireDate), vacation_periods_taken: 0 });
  const r = await api.req('GET', `/api/alerts?year=${today.getUTCFullYear()}&school_id=${novoMundo.id}`);
  assert.ok(r.body.some((a) => a.title.includes('Vencendo')));
});

test('AC2: a bill 25% above its category average triggers an alert', async () => {
  const school = (await api.req('POST', '/api/schools', { name: 'Escola conta alta' })).body;
  const month = new Date().toISOString().slice(0, 7);
  const priorPeriod = (n) => { const [y, m] = month.split('-').map(Number); const t = y * 12 + (m - 1) - n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
  for (let i = 1; i <= 3; i++) {
    await api.req('POST', '/api/bills', { school_id: school.id, description: 'Luz', category: 'Luz', period: priorPeriod(i), due_date: `${priorPeriod(i)}-10`, amount: 100 });
  }
  await api.req('POST', '/api/bills', { school_id: school.id, description: 'Luz', category: 'Luz', period: month, due_date: `${month}-10`, amount: 125 });
  const r = await api.req('GET', `/api/alerts?year=${month.slice(0, 4)}&school_id=${school.id}`);
  assert.ok(r.body.some((a) => a.title.includes('Luz')));
});

test('AC4: turning on the severance reserve reduces the annual result by the reserve amount, and never touches cash', async () => {
  const school = (await api.req('POST', '/api/schools', { name: 'Escola reserva' })).body;
  await api.req('POST', '/api/revenues', { school_id: school.id, description: 'R', monthly_amount: 5000, follows_calendar: 0 });
  await api.req('POST', '/api/employees', { school_id: school.id, name: 'Alguém', salary: 3000, hire_date: '2023-01-10' });

  const before = (await api.req('GET', `/api/report?year=2026&school=${school.id}`)).body;
  await api.req('PUT', `/api/schools/${school.id}`, { turnover_pct: 20 });
  const after = (await api.req('GET', `/api/report?year=2026&school=${school.id}`)).body;

  near(after.totals.cashOut, before.totals.cashOut); // no cash effect
  assert.ok(after.totals.severanceProvision > 0);
  near(after.totals.result, before.totals.result - after.totals.severanceProvision);

  await api.req('PUT', `/api/schools/${school.id}`, { turnover_pct: 0 });
  const off = (await api.req('GET', `/api/report?year=2026&school=${school.id}`)).body;
  assert.deepEqual(off, before); // turning it back off is byte-identical to never having it on
});

test('AC6: invalid input never returns 500', async () => {
  const cases = [
    ['missing school_id', () => api.req('GET', '/api/alerts?year=2026'), 400],
    ['malformed school_id', () => api.req('GET', '/api/alerts?year=2026&school_id=xyz'), 400],
    ['bad year', () => api.req('GET', `/api/alerts?year=abc&school_id=${novoMundo.id}`), 400],
    ['turnover_pct out of range', () => api.req('PUT', `/api/schools/${novoMundo.id}`, { turnover_pct: 500 }), 400],
  ];
  for (const [name, run, expected] of cases) {
    const r = await run();
    assert.equal(r.status, expected, `${name}: expected ${expected}, got ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    assert.ok(r.body.error);
  }
});
