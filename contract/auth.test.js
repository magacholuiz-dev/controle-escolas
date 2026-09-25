import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo, cic;

before(async () => {
  api = await start();
  [novoMundo, cic] = await api.schools();
});
after(() => api.stop());

test('AC1: no session returns 401 on /api/*, except login', async () => {
  const noAuth = await api.req('GET', '/api/schools', undefined, { cookie: '' });
  assert.equal(noAuth.status, 401);

  const wrongCookie = await api.req('GET', '/api/schools', undefined, { cookie: 'sid=not-a-real-token' });
  assert.equal(wrongCookie.status, 401);

  const badLogin = await api.req('POST', '/api/auth/login', { email: 'nobody@test.local', password: 'whatever123' }, { cookie: '' });
  assert.equal(badLogin.status, 401);
});

test('AC2: a director only reaches her own school; the owner reaches both', async () => {
  const created = await api.req('POST', '/api/users', { email: 'diretora.cic@test.local', password: 'director-password', role: 'director', school_ids: [cic.id] });
  assert.equal(created.status, 201);
  const directorCookie = await api.loginAs('diretora.cic@test.local', 'director-password');

  // Her own school: fine.
  const ownReport = await api.req('GET', `/api/report?year=2026&school=${cic.id}`, undefined, { cookie: directorCookie });
  assert.equal(ownReport.status, 200);
  const ownList = await api.req('GET', `/api/employees?school_id=${cic.id}`, undefined, { cookie: directorCookie });
  assert.equal(ownList.status, 200);

  // The other school: 403 everywhere that carries a school id.
  const otherReport = await api.req('GET', `/api/report?year=2026&school=${novoMundo.id}`, undefined, { cookie: directorCookie });
  assert.equal(otherReport.status, 403);
  const otherList = await api.req('GET', `/api/employees?school_id=${novoMundo.id}`, undefined, { cookie: directorCookie });
  assert.equal(otherList.status, 403);
  const otherWrite = await api.req('POST', '/api/employees', { school_id: novoMundo.id, name: 'Invasor' }, { cookie: directorCookie });
  assert.equal(otherWrite.status, 403);

  // "All schools" for a director is scoped down to just her own, never leaking the other one.
  const consolidated = await api.req('GET', `/api/report?year=2026&school=all`, undefined, { cookie: directorCookie });
  assert.equal(consolidated.status, 200);
  assert.equal(consolidated.body.bySchool.length, 1);
  assert.equal(consolidated.body.bySchool[0].id, cic.id);

  // The owner still reaches both.
  const ownerBoth = await api.req('GET', `/api/report?year=2026&school=all`);
  assert.equal(ownerBoth.body.bySchool.length, 2);
});

test('AC3: changing a salary and applying a severance write an audit entry with before/after', async () => {
  const emp = await api.req('POST', '/api/employees', { school_id: novoMundo.id, name: 'Carlos', role: 'Porteiro', salary: 2000, hire_date: '2024-01-10' });
  await api.req('PUT', `/api/employees/${emp.body.id}`, { salary: 2500 });
  const auditAfterSalary = await api.req('GET', `/api/audit?entity_id=${emp.body.id}`);
  const salaryEntry = auditAfterSalary.body.find((a) => a.action === 'employees.update');
  assert.ok(salaryEntry, 'expected an employees.update audit entry');
  assert.equal(salaryEntry.before.salary, 2000);
  assert.equal(salaryEntry.after.salary, 2500);

  await api.req('POST', '/api/severance', { employee_id: emp.body.id, date: '2026-06-30', type: 'without_cause' });
  const auditAfterSeverance = await api.req('GET', `/api/audit?entity_id=${emp.body.id}`);
  assert.ok(auditAfterSeverance.body.some((a) => a.action === 'severance.apply'));
});

test('AC4: 6 wrong passwords lock the account for a while; the 7th (even correct) still fails', async () => {
  await api.req('POST', '/api/users', { email: 'lockout@test.local', password: 'correct-password-1', role: 'director', school_ids: [novoMundo.id] });
  for (let i = 0; i < 6; i++) {
    const r = await api.req('POST', '/api/auth/login', { email: 'lockout@test.local', password: 'wrong' }, { cookie: '' });
    assert.equal(r.status, 401);
  }
  const stillLocked = await api.req('POST', '/api/auth/login', { email: 'lockout@test.local', password: 'correct-password-1' }, { cookie: '' });
  assert.equal(stillLocked.status, 423);
});

test('AC5: the password never comes back in any response body', async () => {
  const created = await api.req('POST', '/api/users', { email: 'nunca.aparece@test.local', password: 'super-secret-123', role: 'director', school_ids: [novoMundo.id] });
  assert.ok(!JSON.stringify(created.body).includes('super-secret-123'));
  const list = await api.req('GET', '/api/users');
  assert.ok(!JSON.stringify(list.body).includes('super-secret-123'));
  assert.ok(!JSON.stringify(list.body).toLowerCase().includes('password_hash'));
  const login = await api.req('POST', '/api/auth/login', { email: 'nunca.aparece@test.local', password: 'super-secret-123' }, { cookie: '' });
  assert.ok(!JSON.stringify(login.body).includes('super-secret-123'));
  assert.ok(!JSON.stringify(login.body).toLowerCase().includes('password_hash'));
});

test('AC6: only the owner manages users; a director gets 403', async () => {
  const directorCookie = await api.loginAs('diretora.cic@test.local', 'director-password');
  const list = await api.req('GET', '/api/users', undefined, { cookie: directorCookie });
  assert.equal(list.status, 403);
  const create = await api.req('POST', '/api/users', { email: 'x@test.local', password: 'whatever123', role: 'director', school_ids: [cic.id] }, { cookie: directorCookie });
  assert.equal(create.status, 403);
});

test('AC7: logging out invalidates the session', async () => {
  const cookie = await api.loginAs('diretora.cic@test.local', 'director-password');
  const before = await api.req('GET', '/api/auth/me', undefined, { cookie });
  assert.equal(before.status, 200);
  await api.req('POST', '/api/auth/logout', undefined, { cookie });
  const afterLogout = await api.req('GET', '/api/auth/me', undefined, { cookie });
  assert.equal(afterLogout.status, 401);
});

test('AC8: adding a cost (expense) is logged with who and what', async () => {
  const created = await api.req('POST', '/api/expenses', { school_id: novoMundo.id, description: 'Material de limpeza extra', category: 'Material de limpeza', monthly_amount: 300 });
  const log = (await api.req('GET', `/api/audit?entity_id=${created.body.id}`)).body;
  const entry = log.find((a) => a.action === 'expenses.create');
  assert.ok(entry, 'expected an expenses.create audit entry');
  assert.equal(entry.user_email, 'owner@test.local');
  assert.equal(entry.after.description, 'Material de limpeza extra');
  assert.equal(entry.after.monthly_amount, 300);
});

test('AC9: deleting an employee ("um professor") is logged with who and which one', async () => {
  const created = await api.req('POST', '/api/employees', { school_id: novoMundo.id, name: 'Professora Joana', role: 'Professora' });
  await api.req('DELETE', `/api/employees/${created.body.id}`);
  const log = (await api.req('GET', `/api/audit?entity_id=${created.body.id}`)).body;
  const entry = log.find((a) => a.action === 'employees.delete');
  assert.ok(entry, 'expected an employees.delete audit entry');
  assert.equal(entry.before.name, 'Professora Joana');
});
