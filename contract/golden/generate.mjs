// Generates contract/golden/golden.json: for every pure function of the legacy app, a list of
// { fn, args, expect } cases (or { fn, args, throws }). The TypeScript domain package must
// reproduce every `expect` exactly (JSON round-trip, cents included). Run: npm run golden
import { writeFileSync } from 'node:fs';
import { calculateSchool, consolidate, activeInMonth } from '../../legacy/calc.js';
import { calculateSeverance } from '../../legacy/severance.js';
import { prorate } from '../../legacy/proration.js';
import { buildStatement } from '../../legacy/statement.js';
import { buildMetrics, betterSchool } from '../../legacy/metrics.js';
import { applyAdjustments } from '../../legacy/scenarios.js';
import { generateAlerts, vacationAlerts, billAboveAverageAlerts, negativeCashAlerts } from '../../legacy/alerts.js';
import { buildInstallments } from '../../legacy/installments.js';
import { dueDateForMonth as billDue, billStatus, generateMonthBills, dueSummary } from '../../legacy/bills.js';
import { isActiveOn, activeFractionInMonth, publicRevenueForMonth, occupancy, validateChild } from '../../legacy/children.js';
import { calculateCharge, dueDateForMonth as tuitionDue, generateMonthTuition, overdueBracket, delinquency, chargeMessage } from '../../legacy/tuition.js';
import { toCsv, payrollRows, PAYROLL_COLUMNS, statementRows, STATEMENT_COLUMNS, paidBillsRows, BILLS_COLUMNS, entriesRows, ENTRIES_COLUMNS } from '../../legacy/export.js';
import { parseOfx } from '../../legacy/ofx.js';
import { fingerprint, suggest } from '../../legacy/reconciliation.js';
import { hashPassword, verifyPassword, isLocked, recordFailedAttempt, canAccessSchool } from '../../legacy/auth.js';

const cases = [];
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
function record(fn, impl, ...args) {
  const a = clone(args);
  try { cases.push({ fn, args: a, expect: clone(impl(...clone(args))) }); }
  catch (e) { cases.push({ fn, args: a, throws: { message: e.message, status: e.status ?? null } }); }
}

// Seeded generator so the fixtures are identical on every run.
let seed = 20260925;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (list) => list[int(0, list.length - 1)];
const money = (a, b) => Math.round((a + rnd() * (b - a)) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');
const date = (y0, y1) => { const y = int(y0, y1), m = int(1, 12); return `${y}-${pad(m)}-${pad(int(1, 28))}`; };

const CATEGORIES = ['Alimentação', 'Aluguel', 'Água', 'Luz', 'Internet', 'Segurança', 'Material de cozinha', 'Material de limpeza', 'Material pedagógico', 'Manutenção', 'Contabilidade', 'Rescisão', 'Outros', 'Categoria nova'];
const DEFAULT_FACTORS = [0, 0.5, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1];

function randomInputs(year) {
  const nEmployees = int(0, 7);
  const employees = Array.from({ length: nEmployees }, (_, i) => ({
    _id: `emp${i}`, name: `Colaborador ${i}`, salary: money(1500, 4200), benefits: pick([0, 0, 300, 550.5]),
    active: pick([1, 1, 1, 0]), hire_date: pick([null, date(2019, 2026)]), termination_date: pick([null, null, null, date(2025, 2027)]),
    vacation_month: pick([null, null, int(1, 12)]), vacation_periods_taken: int(0, 4), fgts_balance: pick([null, null, money(500, 9000)]),
  }));
  const revenues = Array.from({ length: int(0, 3) }, (_, i) => ({ _id: `rev${i}`, description: `Receita ${i}`, monthly_amount: money(2000, 60000), follows_calendar: pick([0, 1, 1]) }));
  const expenses = Array.from({ length: int(0, 6) }, (_, i) => ({ _id: `exp${i}`, description: `Despesa ${i}`, category: pick(CATEGORIES), monthly_amount: money(50, 12000), follows_calendar: pick([0, 0, 1]) }));
  const entries = Array.from({ length: int(0, 12) }, () => ({
    date: `${year}-${pad(int(1, 12))}-${pad(int(1, 28))}`, type: pick(['expense', 'expense', 'revenue']), category: pick(CATEGORIES),
    amount: money(20, 9000), one_off: pick([0, 0, 1]),
  }));
  const children = Array.from({ length: int(0, 10) }, (_, i) => ({
    _id: `kid${i}`, enrollment_type: pick(['public', 'public', 'private']), enrollment_date: pick([null, date(2024, 2026)]), exit_date: pick([null, null, null, date(2025, 2027)]),
  }));
  return {
    school: { payroll_tax_pct: pick([0, 8, 8, 28.8]), tax_pct: pick([0, 6, 4.5]), initial_balance: pick([0, 15000, -2000]), vacation_month: int(1, 12), child_daily_rate: pick([null, 0, 12.5, 18.75]) },
    employees, revenues, expenses,
    factors: pick([DEFAULT_FACTORS, Array(12).fill(1), Array.from({ length: 12 }, () => pick([0, 0.5, 1]))]),
    closedMonths: pick([[], [], Array.from({ length: 12 }, (_, i) => i < int(0, 6))]),
    entries, year, children,
    schoolDays: pick([[], Array.from({ length: 12 }, () => int(0, 22))]),
    revenueDelayMonths: pick([0, 0, 1, 2, 3]),
    severanceReserve: pick([null, null, { turnoverPct: 10 }, { turnoverPct: 25.5 }]),
  };
}

// ---- calc + everything built on top of a report ----
const reports = [];
for (let i = 0; i < 60; i++) {
  const inputs = randomInputs(pick([2026, 2026, 2028, 2025]));
  record('calculateSchool', calculateSchool, inputs);
  const report = calculateSchool(clone(inputs));
  reports.push(report);
  record('buildStatement', buildStatement, report);
  record('buildMetrics', buildMetrics, { report, activeChildren: pick([0, 1, 20, 62]) });
}
record('consolidate', consolidate, reports.slice(0, 2), 15000);
record('consolidate', consolidate, reports.slice(2, 5), 0);
record('betterSchool', betterSchool, [{ id: 'a', value: 3 }, { id: 'b', value: 2 }, { id: 'c', value: null }], 'lower');
record('betterSchool', betterSchool, [{ id: 'a', value: 3 }, { id: 'b', value: 2 }], 'higher');
record('betterSchool', betterSchool, [{ id: 'a', value: null }], 'higher');
for (const [e, y, m] of [[{ active: 1, hire_date: '2026-05-10' }, 2026, 4], [{ active: 1, hire_date: '2026-05-10' }, 2026, 5], [{ active: 0, termination_date: '2026-03-01' }, 2026, 3], [{ active: 0 }, 2026, 1], [{ active: 1 }, 0, 6], [{ active: 1, termination_date: '2026-02-15' }, 2026, 3]]) record('activeInMonth', activeInMonth, e, y, m);

// ---- severance: every type × notice × edge dates ----
const severanceBase = { salary: 2800, hire_date: '2021-03-15', termination_date: '2026-09-22', type: 'without_cause', vacation_periods_taken: 4, fgts_balance: null, notice: 'paid_in_lieu', notice_worked: true };
for (const type of ['without_cause', 'mutual_agreement', 'resignation', 'for_cause']) {
  for (const notice of ['paid_in_lieu', 'worked']) {
    for (const [hire, term] of [['2021-03-15', '2026-09-22'], ['2026-08-20', '2026-09-30'], ['2024-02-29', '2028-02-29'], ['2015-01-31', '2026-01-01'], ['2026-09-22', '2026-09-22'], ['2020-06-10', '2027-06-09'], ['2023-12-31', '2026-02-28']]) {
      record('calculateSeverance', calculateSeverance, { ...severanceBase, type, notice, hire_date: hire, termination_date: term, vacation_periods_taken: pick([0, 1, 3]), fgts_balance: pick([null, 8200.5]), notice_worked: pick([true, false]) });
    }
  }
}
record('calculateSeverance', calculateSeverance, { ...severanceBase, type: 'nope' });
record('calculateSeverance', calculateSeverance, { ...severanceBase, termination_date: '2019-01-01' });
record('calculateSeverance', calculateSeverance, { ...severanceBase, hire_date: 'xx' });

// ---- proration ----
const schools2 = [{ id: 's1', children_count: 62 }, { id: 's2', children_count: 48 }];
for (const total of [1850, 100, 0.01, 999.99, 3333.33]) {
  record('prorate', prorate, total, schools2, 'equal');
  record('prorate', prorate, total, schools2, 'children');
  record('prorate', prorate, total, schools2, 'manual', { s1: 60, s2: 40 });
}
record('prorate', prorate, 100, schools2, 'manual', { s1: 60, s2: 30 });
record('prorate', prorate, 100, [{ id: 's1' }, { id: 's2' }], 'children');
record('prorate', prorate, 0, schools2, 'equal');
record('prorate', prorate, 100, [schools2[0]], 'equal');
record('prorate', prorate, 100, schools2, 'weird');

// ---- installments ----
for (const c of [
  { total: 2000, count: 3, firstDueDate: '2026-10-10' }, { installmentAmount: 340, count: 10, firstDueDate: '2026-01-31' }, { total: 100.1, count: 3, firstDueDate: '2027-12-30' },
  { total: 1, count: 7, firstDueDate: '2028-01-30' }, { total: 0.02, count: 5, firstDueDate: '2026-10-10' }, { total: 100, count: 61, firstDueDate: '2026-10-10' },
  { total: 100, installmentAmount: 30, count: 3, firstDueDate: '2026-10-10' }, { total: 50, count: 1, firstDueDate: '2026-02-30' }, { count: 3, firstDueDate: '2026-10-10' },
]) record('buildInstallments', buildInstallments, c);

// ---- bills ----
for (const [p, d] of [['2026-03', 10], ['2026-02', 30], ['2028-02', 30], ['2026-04', undefined], ['2026/04', 10]]) record('billDueDateForMonth', billDue, p, d);
for (const [b, t] of [[{ paid_at: '2026-03-01', due_date: '2020-01-01' }, '2026-03-10'], [{ paid_at: null, due_date: '2026-03-09' }, '2026-03-10'], [{ paid_at: null, due_date: '2026-03-10' }, '2026-03-10']]) record('billStatus', billStatus, b, t);
record('generateMonthBills', generateMonthBills, [{ _id: 'd1', school_id: 'e1', description: 'Segurança', category: 'Segurança', monthly_amount: 480, due_day: 5 }, { _id: 'd2', school_id: 'e1', description: 'Internet', monthly_amount: 250 }, { _id: 'd3', school_id: 'e1', description: 'Zero', monthly_amount: 0 }], '2026-10');
record('dueSummary', dueSummary, [{ due_date: '2026-09-10', paid_at: null, amount: 100 }, { due_date: '2026-09-25', paid_at: null, amount: 200 }, { due_date: '2026-10-05', paid_at: null, amount: 300 }, { due_date: '2026-09-10', paid_at: '2026-09-09', amount: 999 }], '2026-09-22', 7);

// ---- children ----
const kids = [
  { enrollment_type: 'public', enrollment_date: '2026-03-10', exit_date: '2026-03-20' }, { enrollment_type: 'public', enrollment_date: null, exit_date: null },
  { enrollment_type: 'private', enrollment_date: '2026-05-01', exit_date: null }, { enrollment_type: 'public', enrollment_date: '2027-01-01', exit_date: null },
];
for (const day of ['2026-03-05', '2026-03-15', '2026-03-25', '2026-12-31']) for (const k of kids) record('isActiveOn', isActiveOn, k, day);
for (const m of [2, 3, 5, 12]) for (const k of kids) record('activeFractionInMonth', activeFractionInMonth, k, 2026, m);
for (const [rate, days, m] of [[12.5, 20, 3], [0, 20, 3], [12.5, 0, 3], [null, 10, 3], [18.75, 22, 2]]) record('publicRevenueForMonth', publicRevenueForMonth, { children: kids, childDailyRate: rate, schoolDays: days, year: 2028, month: m });
record('occupancy', occupancy, kids, 4, '2026-03-15');
record('occupancy', occupancy, kids, null, '2026-03-15');
record('occupancy', occupancy, [], 0, '2026-03-15');
record('validateChild', validateChild, { enrollment_date: '2026-05-01', exit_date: '2026-04-01' });
record('validateChild', validateChild, { enrollment_date: '2026-05-01', exit_date: '2026-06-01' });

// ---- tuition ----
for (const [b, d] of [[1000, 0], [1000, 250.5], [100, 500], [0.1, 0.2], [500]]) record('calculateCharge', calculateCharge, b, d);
for (const [p, d] of [['2026-02', 30], ['2026-03', 0], ['2026-13', 5], ['abc', 5]]) record('tuitionDueDateForMonth', tuitionDue, p, d);
const priv = [{ _id: 'k1', school_id: 's', enrollment_type: 'private', tuition_amount: 800, enrollment_date: '2026-01-01' }, { _id: 'k2', school_id: 's', enrollment_type: 'private', tuition_amount: 0 }, { _id: 'k3', school_id: 's', enrollment_type: 'public', tuition_amount: 900 }, { _id: 'k4', school_id: 's', enrollment_type: 'private', tuition_amount: 700, exit_date: '2026-02-10' }];
record('generateMonthTuition', generateMonthTuition, priv, '2026-03', 12);
record('generateMonthTuition', generateMonthTuition, priv, '2026-02');
for (const [d, t, p] of [['2026-09-10', '2026-09-10', false], ['2026-09-10', '2026-09-11', false], ['2026-08-10', '2026-09-10', false], ['2026-07-10', '2026-09-10', false], ['2026-01-10', '2026-09-10', false], ['2026-01-10', '2026-09-10', true]]) record('overdueBracket', overdueBracket, d, t, p);
record('delinquency', delinquency, [{ base_amount: 800, discount: 0, due_date: '2026-09-01', paid_at: null }, { base_amount: 800, discount: 100, due_date: '2026-09-01', paid_at: '2026-09-02' }, { base_amount: 500, discount: 0, due_date: '2026-10-01', paid_at: null }], '2026-09-22');
record('delinquency', delinquency, [], '2026-09-22');
record('chargeMessage', chargeMessage, { base_amount: 1234.5, discount: 34.5, period: '2026-09', due_date: '2026-09-10' }, { name: 'Ana', guardian_name: 'Maria' }, 'CIC');
record('chargeMessage', chargeMessage, { base_amount: 800, discount: 0, period: '2027-01', due_date: '2027-01-10' }, { name: 'Bia' }, 'Novo Mundo');

// ---- scenarios ----
const scenarioInputs = randomInputs(2026);
scenarioInputs.employees = [{ _id: 'e1', salary: 3000, benefits: 400, active: 1, hire_date: '2021-02-01', vacation_periods_taken: 2, fgts_balance: null }, { _id: 'e2', salary: 2200, benefits: 0, active: 1, hire_date: null }];
scenarioInputs.expenses = [{ _id: 'x1', category: 'Alimentação', monthly_amount: 5000, follows_calendar: 1 }, { _id: 'x2', category: 'Luz', monthly_amount: 900, follows_calendar: 0 }];
for (const adjustments of [
  [], [{ type: 'delay_transfer', months: 2 }], [{ type: 'delay_transfer', months: 0 }], [{ type: 'hire', salary: 2500, benefits: 300, hire_date: '2026-06-01' }], [{ type: 'hire', salary: -1 }],
  [{ type: 'terminate', employee_id: 'e1', date: '2026-06-30', severance_type: 'mutual_agreement' }], [{ type: 'terminate', employee_id: 'e2', date: '2026-06-30' }], [{ type: 'terminate', employee_id: 'nope', date: '2026-06-30' }],
  [{ type: 'terminate', employee_id: 'e1', date: '2019-01-01' }], [{ type: 'cut_expense', category: 'Alimentação', pct: 0.2 }], [{ type: 'cut_expense', category: 'Inexistente', pct: 0.5 }], [{ type: 'cut_expense', category: 'Luz', pct: 1.5 }],
  [{ type: 'weird' }, null, { type: 'delay_transfer', months: 1.4 }, { type: 'hire', salary: 1800 }, { type: 'cut_expense', category: 'Luz', pct: 0.1 }],
]) record('applyAdjustments', applyAdjustments, scenarioInputs, adjustments);
record('applyAdjustments', applyAdjustments, scenarioInputs, undefined);

// ---- alerts ----
const alertEmployees = [{ active: 1, name: 'A', hire_date: '2024-11-01', vacation_periods_taken: 0 }, { active: 1, name: 'B', hire_date: '2021-01-10', vacation_periods_taken: 1 }, { active: 0, name: 'C', hire_date: '2019-01-01' }, { active: 1, name: 'D', hire_date: null }, { active: 1, name: 'E', hire_date: '2010-01-01', vacation_periods_taken: 3 }];
const alertBills = [
  { category: 'Luz', period: '2026-09', amount: 500 }, { category: 'Luz', period: '2026-08', amount: 380 }, { category: 'Luz', period: '2026-07', amount: 400 }, { category: 'Água', period: '2026-09', amount: 100 },
  { category: 'Internet', period: '2026-09', amount: 250 }, { category: 'Internet', period: '2026-08', amount: 250 },
];
const balMonths = Array.from({ length: 12 }, (_, i) => ({ balance: [5, 4, -3, -1, 6, 0, -9, 1, 1, 1, 1, 1][i] * 1000 }));
for (const today of ['2026-09-22', '2026-01-05', '2027-03-01']) record('vacationAlerts', vacationAlerts, alertEmployees, today);
record('billAboveAverageAlerts', billAboveAverageAlerts, alertBills, '2026-09');
record('billAboveAverageAlerts', billAboveAverageAlerts, alertBills, '2026-03');
for (const m of [0, 1, 2, 5, 10, 12]) record('negativeCashAlerts', negativeCashAlerts, balMonths, m);
record('generateAlerts', generateAlerts, { employees: alertEmployees, bills: alertBills, months: balMonths, today: '2026-09-22', currentMonth: 1 });
record('generateAlerts', generateAlerts, { today: '2026-09-22' });

// ---- export (CSV) ----
const stmt = buildStatement(calculateSchool(clone(randomInputs(2026))));
record('toCsv', toCsv, [{ a: 'x;y', b: 12.345 }, { a: 'linha\nquebra "aspas"', b: null }, { a: undefined, b: 0.005 }], [{ key: 'a', label: 'Campo; A' }, { key: 'b', label: 'B', type: 'number' }]);
record('payrollRows', payrollRows, [{ name: 'Ana', role: 'Prof', cpf: '1', salary: 3000, benefits: 100, active: 1 }, { name: 'Bia', salary: 2000, active: 0, termination_date: '2026-09-10' }, { name: 'Cida', salary: 2000, active: 0, termination_date: '2026-05-10' }], '2026-09');
record('toCsv', toCsv, payrollRows([{ name: 'Ana', role: 'Prof', cpf: '1', salary: 3000, benefits: 100, active: 1 }], '2026-09'), PAYROLL_COLUMNS);
record('statementRows', statementRows, stmt);
record('toCsv', toCsv, statementRows(stmt), STATEMENT_COLUMNS);
const paidBills = [{ description: 'Água', category: 'Água', period: '2026-06', due_date: '2026-06-10', paid_at: '2026-06-09', amount_paid: 112.5, amount: 100 }, { description: 'Luz', category: 'Luz', period: '2026-07', due_date: '2026-07-10', paid_at: null, amount: 90 }, { description: 'Net', category: 'Internet', period: '2026-06', due_date: '2026-06-12', paid_at: '2026-06-12', amount: 250 }];
record('paidBillsRows', paidBillsRows, paidBills, '2026-06');
record('paidBillsRows', paidBillsRows, paidBills, null);
record('toCsv', toCsv, paidBillsRows(paidBills, null), BILLS_COLUMNS);
const ents = [{ date: '2026-03-10', type: 'expense', category: 'Luz', description: 'Conta; com "aspas"', amount: 123.45 }, { date: '2026-03-11', type: 'revenue', category: 'Mensalidades', amount: 800 }];
record('entriesRows', entriesRows, ents);
record('toCsv', toCsv, entriesRows(ents), ENTRIES_COLUMNS);

// ---- ofx / reconciliation ----
const ofx = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260310120000[-3:BRT]
<TRNAMT>-480.00
<FITID>1001
<NAME>PAGAMENTO FORNECEDOR
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260311
<TRNAMT>800.50
<FITID>1002
<MEMO>PIX RECEBIDO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<FITID>broken
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1234.56<DTASOF>20260311</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;
record('parseOfx', parseOfx, ofx);
record('parseOfx', parseOfx, ofx.replace(/<STMTTRN>[\s\S]*<\/STMTTRN>/, ''));
record('parseOfx', parseOfx, 'not an ofx');
record('parseOfx', parseOfx, '<OFX></OFX>');
for (const t of [{ schoolId: 'e1', date: '2026-03-10', amount: -480, fitid: 'f1' }, { schoolId: 'e1', date: '2026-03-10', amount: 0.1 + 0.2, fitid: '' }]) record('fingerprint', fingerprint, t);
const pool = { bills: [{ id: 'b1', amount: 480, due_date: '2026-03-08' }, { id: 'b2', amount: 480, due_date: '2026-03-01' }], tuitions: [{ id: 't1', amount: 800, due_date: '2026-03-05' }] };
for (const t of [{ date: '2026-03-10', amount: -480 }, { date: '2026-03-12', amount: -480 }, { date: '2026-03-06', amount: 800 }, { date: '2026-03-06', amount: -800 }, { date: '2026-03-10', amount: 480 }]) record('suggest', suggest, t, pool);
record('suggest', suggest, { date: '2026-03-10', amount: -100 });

// ---- auth (hash is random; verify against hashes made by the legacy code) ----
const stored = hashPassword('correct horse');
cases.push({ fn: 'verifyPassword', args: ['correct horse', stored], expect: true });
cases.push({ fn: 'verifyPassword', args: ['wrong', stored], expect: false });
cases.push({ fn: 'verifyPassword', args: ['x', ''], expect: false });
cases.push({ fn: 'verifyPassword', args: ['x', 'zz:zz'], expect: false });
record('canAccessSchool', canAccessSchool, { role: 'owner', school_ids: [] }, 'x');
record('canAccessSchool', canAccessSchool, { role: 'director', school_ids: ['a'] }, 'a');
record('canAccessSchool', canAccessSchool, { role: 'director', school_ids: ['a'] }, 'b');
record('isLocked', isLocked, { locked_until: '2000-01-01T00:00:00.000Z' });
record('isLocked', isLocked, { locked_until: '2999-01-01T00:00:00.000Z' });
record('isLocked', isLocked, {});
// recordFailedAttempt depends on the clock only for the timestamp: compare the attempt count.
for (const n of [0, 4, 5, 9]) {
  const r = recordFailedAttempt({ failed_attempts: n });
  cases.push({ fn: 'recordFailedAttempt#count', args: [{ failed_attempts: n }], expect: { failed_attempts: r.failed_attempts, locked: !!r.locked_until } });
}

writeFileSync(new URL('./golden.json', import.meta.url), JSON.stringify(cases));
console.log(`golden.json: ${cases.length} cases (${cases.filter((c) => c.throws).length} expected throws)`);
