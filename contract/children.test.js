import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo, cic;
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `expected ${b}, got ${a}`);
const CURRENT_PERIOD = new Date().toISOString().slice(0, 7); // YYYY-MM: uses the real month so the school-days test lines up

before(async () => {
  api = await start();
  [novoMundo, cic] = await api.schools();
  await api.req('PUT', `/api/schools/${novoMundo.id}`, { child_daily_rate: 15, capacity: 70 });
});
after(() => api.stop());

test('AC1 and AC4b: a public-slot child generates derived revenue and supersedes the manual revenue', async () => {
  // No children on file yet: the manual "follows calendar" revenue counts normally.
  await api.req('POST', '/api/revenues', { school_id: novoMundo.id, description: 'Contrato Prefeitura', monthly_amount: 60000, follows_calendar: 1 });
  const year = Number(CURRENT_PERIOD.slice(0, 4));
  const month = Number(CURRENT_PERIOD.slice(5, 7));
  const before = (await api.req('GET', `/api/report?year=${year}&school=${novoMundo.id}`)).body;
  assert.ok(before.months[month - 1].revenue > 0, 'with no children on file, the manual revenue still holds');

  await api.req('PUT', `/api/calendar?school_id=${novoMundo.id}&year=${year}`, { month, school_days: 20 });
  await api.req('POST', '/api/children', { school_id: novoMundo.id, name: 'Ana', enrollment_type: 'public', enrollment_date: `${year}-01-01` });

  const after = (await api.req('GET', `/api/report?year=${year}&school=${novoMundo.id}`)).body;
  assert.equal(after.months[month - 1].derivedRevenue, 300); // 1 child × 20 school days × R$15
  // the manual "follows calendar" revenue no longer adds up (avoids double counting); the month's revenue is just the derived one
  assert.equal(after.months[month - 1].revenue, 300);
});

test('AC2: a child who leaves mid-month generates a proportional revenue, then zero', async () => {
  const year = 2027; // a year outside the previous test's flow, to keep it isolated
  await api.req('PUT', `/api/schools/${cic.id}`, { child_daily_rate: 10 });
  await api.req('PUT', `/api/calendar?school_id=${cic.id}&year=${year}`, { month: 4, school_days: 20 });
  await api.req('PUT', `/api/calendar?school_id=${cic.id}&year=${year}`, { month: 5, school_days: 20 });
  await api.req('POST', '/api/children', { school_id: cic.id, name: 'Bia', enrollment_type: 'public', enrollment_date: `${year}-04-01`, exit_date: `${year}-04-10` });

  const report = (await api.req('GET', `/api/report?year=${year}&school=${cic.id}`)).body;
  near(report.months[3].derivedRevenue, 10 * 20 * (10 / 30)); // April has 30 calendar days
  assert.equal(report.months[4].derivedRevenue, 0); // May: had already left
});

test('AC3: school_days changes the derived revenue without touching the transfer factor (expenses)', async () => {
  // A new school (not Novo Mundo/CIC used in the previous tests), so it doesn't inherit children
  // from other tests in this file and we can count exactly 1 active child.
  const third = (await api.req('POST', '/api/schools', { name: 'Escola AC3' })).body;
  await api.req('PUT', `/api/schools/${third.id}`, { child_daily_rate: 20 });
  await api.req('POST', '/api/expenses', { school_id: third.id, description: 'Alimentação', category: 'Alimentação', monthly_amount: 1000, follows_calendar: 1 });
  await api.req('POST', '/api/children', { school_id: third.id, name: 'Caio', enrollment_type: 'public' });

  const year = 2028;
  const calendarBefore = (await api.req('GET', `/api/calendar?school_id=${third.id}&year=${year}`)).body;
  const februaryFactor = calendarBefore[1].factor;
  await api.req('PUT', `/api/calendar?school_id=${third.id}&year=${year}`, { month: 2, school_days: 10 });

  const report = (await api.req('GET', `/api/report?year=${year}&school=${third.id}`)).body;
  assert.equal(report.months[1].derivedRevenue, 200); // 1 child × 10 days × R$20
  assert.equal(report.months[1].factor, februaryFactor); // expenses still follow the usual factor
  assert.equal(report.months[1].expenses, 1000 * februaryFactor);
});

test('AC5: occupancy uses the school\'s capacity and never divides by zero', async () => {
  const noCapacity = (await api.req('GET', `/api/children/occupancy?school_id=${cic.id}`)).body;
  assert.equal(noCapacity.capacity, null);
  assert.equal(noCapacity.pct, null);

  const withCapacity = (await api.req('GET', `/api/children/occupancy?school_id=${novoMundo.id}`)).body;
  assert.equal(withCapacity.capacity, 70);
  assert.ok(withCapacity.active >= 1);
  near(withCapacity.pct, withCapacity.active / 70);
});

test('AC7: an exit date before enrollment, and a partial edit that would create an invalid combination, return 400', async () => {
  const reversed = await api.req('POST', '/api/children', { school_id: novoMundo.id, name: 'Data errada', enrollment_date: '2026-06-01', exit_date: '2026-01-01' });
  assert.equal(reversed.status, 400);
  assert.ok(reversed.body.error);

  const child = (await api.req('POST', '/api/children', { school_id: novoMundo.id, name: 'Duda', enrollment_date: '2026-01-10' })).body;
  const invalidEdit = await api.req('PUT', `/api/children/${child.id}`, { exit_date: '2026-01-01' }); // before the enrollment already on file
  assert.equal(invalidEdit.status, 400);

  const validEdit = await api.req('PUT', `/api/children/${child.id}`, { exit_date: '2026-02-01' });
  assert.equal(validEdit.status, 200);

  const occupancyForMissingSchool = await api.req('GET', `/api/children/occupancy?school_id=${'a'.repeat(24)}`);
  assert.equal(occupancyForMissingSchool.status, 404);

  const invalidSchoolDays = await api.req('PUT', `/api/calendar?school_id=${novoMundo.id}&year=2026`, { month: 3, school_days: 32 });
  assert.equal(invalidSchoolDays.status, 400);
});
