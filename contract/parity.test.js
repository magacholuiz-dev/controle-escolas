// Parallel run (plan §4.4, M4 AC2, M5 gate): the same data is written through the HTTP API of the
// legacy server and of the Nest API, then every read-only endpoint is compared response for response
// (ids normalized, they differ between databases). Any difference — a cent, a field, a status code,
// a CSV byte — fails the test.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { start } from './helpers.js';

const nestBuilt = existsSync(new URL('../apps/api/dist/main.js', import.meta.url));
let legacy, nest;

before(async () => {
  if (!nestBuilt) return;
  legacy = await start({ cmd: 'node legacy/server.js' });
  nest = await start({ cmd: 'node apps/api/dist/main.js' });
});
after(async () => { await legacy?.stop(); await nest?.stop(); });

const OFX = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260310
<TRNAMT>-480.00
<FITID>1001
<NAME>PAGAMENTO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260306
<TRNAMT>720.00
<FITID>1002
<NAME>PIX
</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>1000.00<DTASOF>20260311</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

// Writes the same scenario through one API and returns the ids it needs later, by role.
async function seed(api) {
  const ids = {};
  const [nm, cic] = await api.schools();
  ids.schools = [nm.id, cic.id];
  await api.req('PUT', `/api/schools/${nm.id}`, { children_count: 62, initial_balance: 15000, child_daily_rate: 12.5, capacity: 80, turnover_pct: 10, tuition_due_day: 8 });
  await api.req('PUT', `/api/schools/${cic.id}`, { children_count: 48, initial_balance: 2000, payroll_tax_pct: 28.8 });
  const supplier = (await api.req('POST', '/api/suppliers', { name: 'Fornecedor X', tax_id: '123', contact: 'x@y' })).body;
  for (const school of [nm, cic]) {
    const sid = school.id;
    const isNm = sid === nm.id;
    const emp = (await api.req('POST', '/api/employees', { school_id: sid, name: 'Ana', role: 'Professora', salary: isNm ? 3200 : 2900, benefits: 600, hire_date: '2021-02-01', vacation_periods_taken: 2, cpf: '111' })).body;
    if (isNm) ids.employee = emp.id;
    await api.req('POST', '/api/employees', { school_id: sid, name: 'Bia', salary: 2300.5, benefits: 500, hire_date: '2024-08-15', vacation_month: 7 });
    await api.req('POST', '/api/employees', { school_id: sid, name: 'Cida', salary: 2100, hire_date: '2019-03-10', termination_date: '2026-05-20', active: 0 });
    await api.req('POST', '/api/revenues', { school_id: sid, description: 'Contrato', monthly_amount: 40000, follows_calendar: 1 });
    await api.req('POST', '/api/revenues', { school_id: sid, description: 'Outras', monthly_amount: 1500.75, follows_calendar: 0 });
    await api.req('POST', '/api/expenses', { school_id: sid, description: 'Alimentação', category: 'Alimentação', monthly_amount: 6000, follows_calendar: 1, due_day: 5 });
    await api.req('POST', '/api/expenses', { school_id: sid, description: 'Aluguel', category: 'Aluguel', monthly_amount: 4400, due_day: 30 });
    await api.req('POST', '/api/expenses', { school_id: sid, description: 'Nova', category: 'Categoria nova', monthly_amount: 99.99 });
    await api.req('POST', '/api/entries', { school_id: sid, date: '2026-03-08', type: 'expense', category: 'Luz', description: 'Conta; "março"', amount: 880 });
    await api.req('POST', '/api/entries', { school_id: sid, date: '2026-03-12', type: 'expense', category: 'Material de cozinha', amount: 925, one_off: 1 });
    await api.req('POST', '/api/entries', { school_id: sid, date: '2026-04-02', type: 'revenue', category: 'Doação', amount: 300, one_off: 1 });
    await api.req('PUT', `/api/calendar?school_id=${sid}&year=2026`, { month: 2, closed: true });
    await api.req('PUT', `/api/calendar?school_id=${sid}&year=2026`, { month: 3, school_days: 18, factor: 0.8 });
    await api.req('POST', '/api/children', { school_id: sid, name: 'Criança pública 1', enrollment_type: 'public', enrollment_date: '2026-01-15' });
    await api.req('POST', '/api/children', { school_id: sid, name: 'Criança pública 2', enrollment_type: 'public', enrollment_date: '2025-02-01', exit_date: '2026-06-10' });
    await api.req('POST', '/api/children', { school_id: sid, name: 'Criança particular', enrollment_type: 'private', tuition_amount: 900, guardian_name: 'Maria', enrollment_date: '2026-01-01' });
    await api.req('POST', '/api/bills', { school_id: sid, supplier_id: supplier.id, description: 'Água', category: 'Água', period: '2026-08', due_date: '2026-08-10', amount: 120 });
    await api.req('POST', '/api/bills', { school_id: sid, description: 'Água', category: 'Água', period: '2026-09', due_date: '2026-09-10', amount: 190 });
    await api.req('POST', '/api/bills/generate', { school_id: sid, period: '2026-10' });
    const inst = (await api.req('POST', '/api/bills/installments', { school_id: sid, description: 'Geladeira', category: 'Manutenção', first_due_date: '2026-10-31', count: 3, total_amount: 2000 })).body;
    if (isNm) ids.installment = inst.installment_group_id;
    await api.req('POST', '/api/tuition/generate', { school_id: sid, period: '2026-09' });
    await api.req('POST', '/api/tuition/generate', { school_id: sid, period: '2026-03' });
  }
  const bills = (await api.req('GET', `/api/bills?school_id=${nm.id}`)).body;
  const toPay = bills.find((b) => b.description === 'Água' && b.period === '2026-08');
  await api.req('POST', `/api/bills/${toPay.id}/pay`, { amount_paid: 125.5, paid_at: '2026-08-09' });
  const tuition = (await api.req('GET', `/api/tuition?school_id=${nm.id}`)).body;
  await api.req('POST', `/api/tuition/${tuition[0].id}/pay`, { paid_at: '2026-03-07' });
  await api.req('POST', '/api/split', { resource: 'expenses', data: { description: 'Panelas', category: 'Material de cozinha', monthly_amount: 1850 }, mode: 'children', percentages: {} });
  await api.req('POST', '/api/bank/import', { school_id: nm.id, ofx: OFX });
  await api.req('POST', '/api/scenarios', { school_id: nm.id, name: 'Cenário', adjustments: [{ type: 'delay_transfer', months: 2 }] });
  return ids;
}

const normalize = (value) => JSON.stringify(value).replace(/[0-9a-f]{64}/g, '<sha>').replace(/[0-9a-f]{24}/g, '<id>').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>');

// First path where two JSON values differ, for readable failures.
function firstDiff(a, b, path = '') {
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return Object.is(a, b) || a === b ? null : `${path}: legacy=${JSON.stringify(a)} nest=${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array vs object`;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = firstDiff(a[k], b[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}
const same = (label, a, b) => {
  const [x, y] = [JSON.parse(normalize(a)), JSON.parse(normalize(b))];
  assert.equal(firstDiff(x, y), null, `${label} differs`);
};

test('legacy and Nest give identical answers on the same data, endpoint by endpoint', { skip: !nestBuilt && 'apps/api is not built' }, async () => {
  const ids = [await seed(legacy), await seed(nest)];
  const reads = (i) => [
    '/api/schools', '/api/report?year=2026&school=all', `/api/report?year=2026&school=${ids[i].schools[0]}`, `/api/report?year=2026&school=${ids[i].schools[1]}`,
    '/api/report?year=2028&school=all', '/api/statement?year=2026&school=all', `/api/statement?year=2026&school=${ids[i].schools[1]}`,
    '/api/metrics?year=2026&school=all', `/api/metrics?year=2026&school=${ids[i].schools[0]}`, `/api/alerts?year=2026&school_id=${ids[i].schools[0]}`,
    `/api/alerts?year=2026&school_id=${ids[i].schools[1]}`, `/api/children/occupancy?school_id=${ids[i].schools[0]}`,
    `/api/employees?school_id=${ids[i].schools[0]}`, `/api/employees?school_id=${ids[i].schools[1]}`, '/api/employees', `/api/revenues?school_id=${ids[i].schools[0]}`,
    `/api/expenses?school_id=${ids[i].schools[0]}`, `/api/entries?school_id=${ids[i].schools[0]}&year=2026`, `/api/entries?school_id=${ids[i].schools[1]}`,
    `/api/children?school_id=${ids[i].schools[0]}`, `/api/bills?school_id=${ids[i].schools[0]}`, `/api/bills?school_id=${ids[i].schools[0]}&period=2026-10`,
    `/api/tuition?school_id=${ids[i].schools[0]}`, `/api/tuition?school_id=${ids[i].schools[1]}&period=2026-03`, '/api/suppliers', `/api/scenarios?school_id=${ids[i].schools[0]}`,
    '/api/bills/panel?school=all&days=30', `/api/bills/panel?school=${ids[i].schools[1]}`, '/api/tuition/panel?school=all', `/api/tuition/panel?school=${ids[i].schools[0]}`,
    `/api/calendar?school_id=${ids[i].schools[0]}&year=2026`, '/api/bank/list?school=all', `/api/bank/list?school=${ids[i].schools[0]}`,
    `/api/export/payroll?school_id=${ids[i].schools[0]}&period=2026-05`, `/api/export/statement?school_id=${ids[i].schools[0]}&year=2026`,
    `/api/export/bills?school_id=${ids[i].schools[0]}`, `/api/export/entries?school_id=${ids[i].schools[0]}&year=2026`,
    `/api/severance?employee_id=${ids[i].employee}&date=2026-09-22&type=without_cause`, `/api/severance?employee_id=${ids[i].employee}&date=2026-09-22&type=mutual_agreement&notice=worked&notice_worked=0`,
    `/api/severance?employee_id=${ids[i].employee}&date=2026-09-22&type=nope`, '/api/audit',
    // error paths: same status and same message
    '/api/report?year=1999', '/api/report?school=xyz', '/api/statement?year=abc', `/api/export/made-up?school_id=${ids[i].schools[0]}`, `/api/export/payroll?school_id=${ids[i].schools[0]}`,
    '/api/employees?school_id=xyz', '/api/nothing-here',
  ];
  const [readsLegacy, readsNest] = [reads(0), reads(1)];
  for (let n = 0; n < readsLegacy.length; n++) {
    const [a, b] = await Promise.all([legacy.req('GET', readsLegacy[n]), nest.req('GET', readsNest[n])]);
    assert.equal(b.status, a.status, `${readsLegacy[n]}: status ${b.status} != ${a.status}`);
    if (readsLegacy[n].startsWith('/api/audit')) {
      // ids and timestamps differ; the actions, who and what must not
      const strip = (list) => list.map((x) => ({ user_email: x.user_email, action: x.action, entity: x.entity, before: x.before, after: x.after })).sort((p, q) => JSON.stringify(p).localeCompare(JSON.stringify(q)));
      same('/api/audit', strip(a.body), strip(b.body));
      continue;
    }
    if (readsLegacy[n] === '/api/nothing-here') continue; // legacy 404 text differs from Nest's; only the status matters
    same(readsLegacy[n], a.body, b.body);
    assert.equal(b.headers.get('content-type'), a.headers.get('content-type'), `${readsLegacy[n]}: content-type`);
  }

  // Writes that return computed values: same numbers, same message.
  const sim = (i) => ({ school_id: ids[i].schools[0], year: 2026, adjustments: [{ type: 'hire', salary: 2500 }, { type: 'terminate', employee_id: ids[i].employee, date: '2026-06-30' }, { type: 'cut_expense', category: 'Alimentação', pct: 0.2 }, { type: 'delay_transfer', months: 2 }, { type: 'weird' }] });
  const [s1, s2] = await Promise.all([legacy.req('POST', '/api/scenarios/simulate', sim(0)), nest.req('POST', '/api/scenarios/simulate', sim(1))]);
  assert.equal(s2.status, s1.status);
  same('simulate', s1.body, s2.body);
});
