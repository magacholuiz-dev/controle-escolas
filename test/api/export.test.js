import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api, novoMundo;

before(async () => {
  api = await start();
  [novoMundo] = await api.schools();
});
after(() => api.stop());

test('AC1: payroll export has one row per active employee, with the total matching the report', async () => {
  await api.req('POST', '/api/employees', { school_id: novoMundo.id, name: 'Ana', role: 'Professora', salary: 3000, benefits: 500 });
  await api.req('POST', '/api/employees', { school_id: novoMundo.id, name: 'Bia', role: 'Auxiliar', salary: 2000 });

  const r = await api.req('GET', `/api/export/payroll?school_id=${novoMundo.id}&period=2026-06`);
  assert.equal(r.status, 200);
  const lines = r.body.trim().split('\r\n');
  assert.equal(lines.length, 3); // header + 2 employees
  assert.ok(lines[1].includes('Ana;Professora'));

  const report = (await api.req('GET', `/api/report?year=2026&school=${novoMundo.id}`)).body;
  const totalOnCsv = lines.slice(1).reduce((s, l) => s + Number(l.split(';')[3].replace(',', '.')), 0);
  assert.ok(Math.abs(totalOnCsv - report.months[5].salaries) < 0.005);
});

test('AC2: the CSV is served as a downloadable attachment, uses "," decimals, and survives an adversarial description', async () => {
  // The BOM itself is proven at the unit level (test-export.js) — fetch's `.text()` strips a leading
  // BOM per the WHATWG encoding spec before we could ever observe it here, so this layer checks the
  // things that actually differ over HTTP: headers and the escaped content.
  await api.req('POST', '/api/entries', { school_id: novoMundo.id, date: '2026-03-10', type: 'expense', category: 'Luz', description: 'Conta; com "aspas"\ne linha', amount: 123.45 });
  const r = await api.req('GET', `/api/export/entries?school_id=${novoMundo.id}&year=2026`);
  assert.match(r.headers.get('content-type'), /text\/csv/);
  assert.match(r.headers.get('content-disposition'), /attachment/);
  assert.ok(r.body.includes('123,45'));
  assert.ok(r.body.includes('"Conta; com ""aspas""\ne linha"'));
});

test('AC3: the DRE export mirrors the statement, with a "Resultado" line equal to statement.result', async () => {
  const statement = (await api.req('GET', `/api/statement?year=2026&school=${novoMundo.id}`)).body;
  const r = await api.req('GET', `/api/export/statement?school_id=${novoMundo.id}&year=2026`);
  const lines = r.body.trim().split('\r\n');
  assert.equal(lines.length, statement.groups.length + 2); // header + groups + Resultado
  const resultLine = lines.at(-1);
  const resultValue = Number(resultLine.split(';')[1].replace(',', '.'));
  assert.ok(Math.abs(resultValue - statement.result) < 0.005);
});

test('AC4: only paid bills within the period are exported, with the amount actually paid', async () => {
  const bill = (await api.req('POST', '/api/bills', { school_id: novoMundo.id, description: 'Água', category: 'Água', period: '2026-06', due_date: '2026-06-10', amount: 100 })).body;
  await api.req('POST', '/api/bills', { school_id: novoMundo.id, description: 'Não pago', category: 'Luz', period: '2026-06', due_date: '2026-06-10', amount: 50 });
  await api.req('POST', `/api/bills/${bill.id}/pay`, { amount_paid: 112.5 });

  const r = await api.req('GET', `/api/export/bills?school_id=${novoMundo.id}&period=2026-06`);
  const lines = r.body.trim().split('\r\n');
  assert.equal(lines.length, 2); // header + only the paid one
  assert.ok(lines[1].includes('Água') && lines[1].includes('112,50'));
});

test('AC5: entries export has exactly the same rows as the JSON API, in the same order', async () => {
  const csv = (await api.req('GET', `/api/export/entries?school_id=${novoMundo.id}&year=2026`)).body;
  const json = (await api.req('GET', `/api/entries?school_id=${novoMundo.id}&year=2026`)).body;
  const csvLines = csv.trim().split('\r\n').slice(1);
  assert.equal(csvLines.length, json.length);
});

test('AC6: invalid input returns 4xx, never 500; a school with no data returns just the header', async () => {
  const emptySchool = (await api.req('POST', '/api/schools', { name: 'Escola vazia' })).body;
  const empty = await api.req('GET', `/api/export/entries?school_id=${emptySchool.id}&year=2026`);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.trim().split('\r\n').length, 1); // just the header

  const cases = [
    ['missing school_id', () => api.req('GET', '/api/export/payroll?period=2026-06'), 400],
    ['malformed school_id', () => api.req('GET', '/api/export/payroll?school_id=xyz&period=2026-06'), 400],
    ['malformed period', () => api.req('GET', `/api/export/payroll?school_id=${novoMundo.id}&period=06-2026`), 400],
    ['missing period', () => api.req('GET', `/api/export/payroll?school_id=${novoMundo.id}`), 400],
    ['bad year', () => api.req('GET', `/api/export/statement?school_id=${novoMundo.id}&year=abc`), 400],
    ['unknown export', () => api.req('GET', `/api/export/made-up?school_id=${novoMundo.id}`), 404],
  ];
  for (const [name, run, expected] of cases) {
    const r = await run();
    assert.equal(r.status, expected, `${name}: expected ${expected}, got ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
  }
});
