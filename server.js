import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { connect, ensureCalendar, Calendar, School, Employee, Revenue, Expense, Entry, Supplier, Bill, Child, Tuition, Scenario, BankTransaction, User, Session, AuditLog } from './db.js';
import { hashPassword, verifyPassword, createSessionToken, isLocked, recordFailedAttempt, canAccessSchool } from './auth.js';
import { calculateSchool, consolidate } from './calc.js';
import { calculateSeverance, SEVERANCE_TYPES } from './severance.js';
import { applyAdjustments } from './scenarios.js';
import { generateAlerts } from './alerts.js';
import { toCsv, payrollRows, PAYROLL_COLUMNS, statementRows, STATEMENT_COLUMNS, paidBillsRows, BILLS_COLUMNS, entriesRows, ENTRIES_COLUMNS } from './export.js';
import { parseOfx } from './ofx.js';
import { fingerprint, suggest } from './reconciliation.js';
import { prorate } from './proration.js';
import { billStatus, generateMonthBills, dueSummary } from './bills.js';
import { buildInstallments } from './installments.js';
import { validateChild, occupancy, isActiveOn } from './children.js';
import { calculateCharge, generateMonthTuition, overdueBracket, delinquency, chargeMessage } from './tuition.js';
import { buildStatement } from './statement.js';
import { buildMetrics, betterSchool } from './metrics.js';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { InputError, validationMessage } from './errors.js';

const PORT = Number(process.env.PORT) || 3200;
const HOST = process.env.LISTEN_HOST || '127.0.0.1'; // this machine (or behind a local reverse proxy) — see Loop 8's design notes
const MAX_BODY = 1024 * 1024;
const PUBLIC = new URL('./public', import.meta.url).pathname;
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS) || 24 * 7;
const COOKIE_SECURE = process.env.COOKIE_SECURE === '1';
// SameSite=Strict only works when the front and the API share a site (e.g. the droplet serving
// both, or local dev). Once the front is on a different origin (Vercel calling the droplet's API),
// the cookie must be SameSite=None — which browsers only honor together with Secure — so this
// follows COOKIE_SECURE instead of being its own flag.
const COOKIE_SAMESITE = COOKIE_SECURE ? 'None' : 'Strict';
// Exact origins from CORS_ORIGINS (comma-separated), plus every *.vercel.app preview/production
// deploy of this project — same allowance Kivoni's API uses for its own Vercel front.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const isAllowedOrigin = (origin) => !!origin && (CORS_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin));

const parseCookies = (header) => Object.fromEntries(String(header || '').split(';').filter(Boolean).map((p) => {
  const i = p.indexOf('=');
  return [p.slice(0, i).trim(), decodeURIComponent(p.slice(i + 1).trim())];
}));
const setSessionCookie = (res, token, maxAgeSeconds) => {
  res.setHeader('Set-Cookie', `sid=${token}; Path=/; HttpOnly; SameSite=${COOKIE_SAMESITE}; Max-Age=${maxAgeSeconds}${COOKIE_SECURE ? '; Secure' : ''}`);
};
const clearSessionCookie = (res) => {
  res.setHeader('Set-Cookie', `sid=; Path=/; HttpOnly; SameSite=${COOKIE_SAMESITE}; Max-Age=0${COOKIE_SECURE ? '; Secure' : ''}`);
};

async function currentUser(req) {
  const token = parseCookies(req.headers.cookie).sid;
  if (!token) return null;
  const session = await Session.findOne({ token, expires_at: { $gt: new Date() } }).lean();
  if (!session) return null;
  const user = await User.findById(session.user_id).lean();
  if (!user) return null;
  return { id: String(user._id), email: user.email, role: user.role, school_ids: (user.school_ids || []).map(String) };
}

async function login({ email, password }) {
  if (!email || !password) throw new InputError('email e senha são obrigatórios');
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) throw new InputError('email ou senha inválidos', 401);
  if (isLocked(user)) throw new InputError('conta bloqueada temporariamente após várias tentativas erradas; tente novamente mais tarde', 423);
  if (!verifyPassword(password, user.password_hash)) {
    const { failed_attempts, locked_until } = recordFailedAttempt(user);
    await User.updateOne({ _id: user._id }, { $set: { failed_attempts, locked_until } });
    throw new InputError('email ou senha inválidos', 401);
  }
  if (user.failed_attempts) await User.updateOne({ _id: user._id }, { $set: { failed_attempts: 0, locked_until: null } });
  const token = createSessionToken();
  await Session.create({ token, user_id: user._id, expires_at: new Date(Date.now() + SESSION_TTL_HOURS * 3600000) });
  return { token, maxAgeSeconds: SESSION_TTL_HOURS * 3600, user: { id: String(user._id), email: user.email, role: user.role, school_ids: (user.school_ids || []).map(String) } };
}

function requireSchoolAccess(user, schoolId) {
  if (!canAccessSchool(user, schoolId)) throw new InputError('acesso não permitido a esta escola', 403);
}

// Same check, but against a raw list of allowed ids (or null = unrestricted) instead of a user
// object — used where a function only has the caller's scope, not the full user.
function checkAllowed(allowedIds, schoolId) {
  if (allowedIds && !allowedIds.map(String).includes(String(schoolId))) throw new InputError('acesso não permitido a esta escola', 403);
}

async function audit(user, action, { entity = '', entity_id = null, school_id = null, before = null, after = null } = {}) {
  await AuditLog.create({ user_email: user.email, action, entity, entity_id, school_id, before, after });
}

// A short, human-readable snapshot of a document for the audit log — just enough to recognize
// "which one" without dumping every field (or sensitive ones not meant for the log either).
const AUDIT_SUMMARY_FIELDS = {
  employees: ['name', 'role', 'salary'],
  revenues: ['description', 'monthly_amount'],
  expenses: ['description', 'monthly_amount'],
  entries: ['description', 'amount', 'category'],
  schools: ['name'],
  children: ['name'],
  tuition: ['base_amount', 'discount'],
  suppliers: ['name'],
  scenarios: ['name'],
  bills: ['description', 'amount'],
};
function docSummary(resource, doc) {
  const out = {};
  for (const f of AUDIT_SUMMARY_FIELDS[resource] || []) if (doc[f] !== undefined) out[f] = doc[f];
  return out;
}
// Only the fields that actually changed, so a log entry doesn't repeat every column on every edit.
function changedFields(data, existing) {
  const before = {}; const after = {};
  for (const k of Object.keys(data)) {
    if (JSON.stringify(data[k]) !== JSON.stringify(existing[k])) { before[k] = existing[k]; after[k] = data[k]; }
  }
  return { before, after, hasChanges: Object.keys(after).length > 0 };
}

async function listUsers() {
  const users = await User.find().select('-password_hash').sort('email').lean();
  return users.map(({ _id, school_ids, ...u }) => ({ ...u, id: String(_id), school_ids: (school_ids || []).map(String) }));
}

async function createUser(actor, { email, password, role, school_ids }) {
  if (!email || !password) throw new InputError('email e senha são obrigatórios');
  if (!['owner', 'director'].includes(role)) throw new InputError('role deve ser owner ou director');
  if (String(password).length < 8) throw new InputError('senha deve ter ao menos 8 caracteres');
  const ids = role === 'director' ? (school_ids || []).map((sid) => requireId(sid, 'school_ids')) : [];
  if (role === 'director' && !ids.length) throw new InputError('diretora precisa de ao menos uma escola');
  const doc = await User.create({ email: String(email).toLowerCase().trim(), password_hash: hashPassword(password), role, school_ids: ids });
  await audit(actor, 'user.create', { entity: 'User', entity_id: doc._id, after: { email: doc.email, role: doc.role, school_ids: ids } });
  return { id: String(doc._id) };
}

async function updateUser(actor, id, { role, school_ids, password }) {
  const user = await User.findById(id);
  if (!user) throw new InputError('usuário não encontrado', 404);
  const before = { role: user.role, school_ids: (user.school_ids || []).map(String) };
  if (role !== undefined) {
    if (!['owner', 'director'].includes(role)) throw new InputError('role deve ser owner ou director');
    user.role = role;
  }
  if (school_ids !== undefined) user.school_ids = (school_ids || []).map((sid) => requireId(sid, 'school_ids'));
  if (user.role === 'director' && !user.school_ids.length) throw new InputError('diretora precisa de ao menos uma escola');
  if (password) {
    if (String(password).length < 8) throw new InputError('senha deve ter ao menos 8 caracteres');
    user.password_hash = hashPassword(password);
  }
  await user.save();
  await audit(actor, 'user.update', { entity: 'User', entity_id: user._id, before, after: { role: user.role, school_ids: user.school_ids.map(String) } });
  return { ok: true };
}

async function deleteUser(actor, id) {
  if (String(actor.id) === String(id)) throw new InputError('não é possível excluir o próprio usuário logado');
  const removed = await User.findOneAndDelete({ _id: id });
  if (!removed) throw new InputError('usuário não encontrado', 404);
  await Session.deleteMany({ user_id: removed._id });
  await audit(actor, 'user.delete', { entity: 'User', entity_id: removed._id, before: { email: removed.email, role: removed.role } });
  return { ok: true };
}

// Resources with a generic CRUD. `cols` is the whitelist of writable fields.
const RESOURCES = {
  employees: { model: Employee, cols: ['school_id', 'name', 'role', 'cpf', 'salary', 'benefits', 'hire_date', 'termination_date', 'vacation_periods_taken', 'fgts_balance', 'vacation_month', 'active'] },
  revenues: { model: Revenue, cols: ['school_id', 'description', 'monthly_amount', 'follows_calendar'] },
  expenses: { model: Expense, cols: ['school_id', 'description', 'category', 'monthly_amount', 'follows_calendar', 'due_day'] },
  entries: { model: Entry, cols: ['school_id', 'date', 'type', 'category', 'description', 'amount', 'one_off'] },
  schools: { model: School, cols: ['name', 'payroll_tax_pct', 'tax_pct', 'initial_balance', 'vacation_month', 'children_count', 'capacity', 'child_daily_rate', 'tuition_due_day', 'turnover_pct'] },
  children: {
    model: Child,
    cols: ['school_id', 'name', 'birth_date', 'classroom', 'guardian_name', 'guardian_phone', 'enrollment_type', 'tuition_amount', 'enrollment_date', 'exit_date'],
    validate: async (data, existing) => validateChild({
      enrollment_date: 'enrollment_date' in data ? data.enrollment_date : existing?.enrollment_date,
      exit_date: 'exit_date' in data ? data.exit_date : existing?.exit_date,
    }),
  },
  tuition: {
    model: Tuition,
    cols: ['school_id', 'child_id', 'period', 'base_amount', 'discount', 'due_date'],
    validate: async (data) => {
      if (data.child_id) {
        requireId(data.child_id, 'child_id');
        if (!(await Child.exists({ _id: data.child_id }))) throw new InputError('criança não encontrada');
      }
    },
  },
  suppliers: { model: Supplier, cols: ['name', 'tax_id', 'contact'] },
  scenarios: { model: Scenario, cols: ['school_id', 'name', 'adjustments'] },
  bills: {
    model: Bill, cols: ['school_id', 'supplier_id', 'description', 'category', 'period', 'due_date', 'amount'],
    validate: async (data) => {
      if (data.supplier_id) {
        requireId(data.supplier_id, 'supplier_id');
        if (!(await Supplier.exists({ _id: data.supplier_id }))) throw new InputError('fornecedor não encontrado');
      }
    },
  },
};

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

const sendCsv = (res, filename, content) => {
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
  res.end(content);
};

const readBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  let tooBig = false;
  req.on('data', (c) => {
    if (tooBig) return; // keep draining the body so we can still respond 413
    raw += c;
    if (raw.length > MAX_BODY) { tooBig = true; raw = ''; reject(new InputError('corpo da requisição grande demais', 413)); }
  });
  req.on('end', () => {
    if (tooBig) return;
    if (!raw) return resolve({});
    try {
      const body = JSON.parse(raw);
      if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error();
      resolve(body);
    } catch { reject(new InputError('corpo da requisição não é um JSON de objeto válido')); }
  });
});

// Route/query parameter validation.
const requireId = (v, name = 'id') => {
  if (!mongoose.isValidObjectId(v) || String(v).length !== 24) throw new InputError(`${name} inválido`);
  return v;
};
const requireYear = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new InputError('ano inválido (use um ano entre 2000 e 2100)');
  return n;
};

function pickFields(cols, body) {
  const out = {};
  for (const c of cols) if (c in body) out[c] = body[c] === '' ? null : body[c];
  return out;
}

// Loads the exact plain-object inputs `calculateSchool` expects, for one school. Shared by
// `buildReport` and the scenario simulator, so both always compute from the same real data.
async function loadSchoolInputs(school, year) {
  await ensureCalendar(school._id, year);
  const [employees, revenues, expenses, cal, entries, children] = await Promise.all([
    Employee.find({ school_id: school._id }).lean(),
    Revenue.find({ school_id: school._id }).lean(),
    Expense.find({ school_id: school._id }).lean(),
    Calendar.find({ school_id: school._id, year }).sort('month').lean(),
    Entry.find({ school_id: school._id, date: { $regex: `^${year}-` } }).lean(),
    Child.find({ school_id: school._id }).lean(),
  ]);
  return {
    school, employees, revenues, expenses, factors: cal.map((c) => c.factor), closedMonths: cal.map((c) => c.closed),
    entries, year, children, schoolDays: cal.map((c) => c.school_days),
    severanceReserve: school.turnover_pct > 0 ? { turnoverPct: school.turnover_pct } : null,
  };
}

async function buildReport(year, schoolParam, allowedIds = null) {
  if (schoolParam !== 'all') { requireId(schoolParam, 'school'); checkAllowed(allowedIds, schoolParam); }
  const filter = schoolParam === 'all' ? (allowedIds ? { _id: { $in: allowedIds } } : {}) : { _id: schoolParam };
  const schools = await School.find(filter).sort('_id').lean();
  const results = await Promise.all(schools.map(async (school) => calculateSchool(await loadSchoolInputs(school, year))));
  if (schoolParam !== 'all') return results[0];
  return { ...consolidate(results, schools.reduce((s, e) => s + e.initial_balance, 0)), bySchool: schools.map((e, i) => ({ id: String(e._id), name: e.name, ...results[i].totals })) };
}

const summarize = (report) => ({
  result: report.totals.result, revenue: report.totals.revenue,
  minBalance: report.minBalance, minBalanceMonth: report.minBalanceMonth,
  finalBalance: report.finalBalance, reserveNeeded: report.reserveNeeded,
});

async function simulateScenario({ school_id, year, adjustments }) {
  requireId(school_id, 'school_id');
  const y = requireYear(year ?? new Date().getFullYear());
  if (adjustments !== undefined && !Array.isArray(adjustments)) throw new InputError('adjustments deve ser uma lista');
  const school = await School.findById(school_id).lean();
  if (!school) throw new InputError('escola não encontrada', 404);
  const inputs = await loadSchoolInputs(school, y);
  const base = calculateSchool(inputs);
  const applied = applyAdjustments(inputs, adjustments || []);
  const scenario = calculateSchool({ ...inputs, ...applied });
  return { base: summarize(base), scenario: summarize(scenario), warnings: applied.warnings };
}

// Creates one expense/entry per school, with the amount split, linked by `group_id`.
async function splitAmount(user, { resource, data, mode, percentages }) {
  const resourceDef = RESOURCES[resource];
  if (!resourceDef || !['expenses', 'entries', 'bills'].includes(resource)) throw new InputError('só despesas, lançamentos e contas podem ser divididos');
  if (!data || typeof data !== 'object') throw new InputError('dados da divisão ausentes');
  await resourceDef.validate?.(data);
  const amountField = resource === 'expenses' ? 'monthly_amount' : 'amount';
  const schools = (await School.find().sort('_id').lean()).map((e) => ({ id: String(e._id), children_count: e.children_count }));
  const splits = prorate(Number(data[amountField]), schools, mode, percentages);
  const group_id = randomUUID();
  const base = pickFields(resourceDef.cols, data);
  const docs = await resourceDef.model.create(splits.filter((p) => p.amount > 0).map((p) => ({
    ...base, school_id: p.school_id, [amountField]: p.amount, group_id, total_amount: Number(data[amountField]), split_pct: p.pct,
  })));
  for (const doc of docs) await audit(user, `${resource}.create`, { entity: resource, entity_id: doc._id, school_id: doc.school_id, after: { ...docSummary(resource, doc), group_id } });
  return { group_id, splits, ids: docs.map((d) => String(d._id)) };
}

// Generates the month's bills for a school from its recurring expenses. Idempotent: expenses that
// already have a bill for this period (unique expense_id+period index) are silently skipped.
async function generateBills({ school_id, period }) {
  requireId(school_id, 'school_id');
  if (!/^\d{4}-\d{2}$/.test(period || '')) throw new InputError('competencia inválida (use AAAA-MM)');
  const expenses = await Expense.find({ school_id }).lean();
  const candidates = generateMonthBills(expenses, period);
  if (!candidates.length) return { created: 0 };
  const existing = new Set((await Bill.find({ school_id, period }).select('expense_id').lean()).map((c) => String(c.expense_id)));
  const fresh = candidates.filter((c) => !existing.has(String(c.expense_id)));
  if (fresh.length) await Bill.insertMany(fresh, { ordered: false });
  return { created: fresh.length };
}

// An installment purchase ("R$ 2.000 in 3x" or "10x of R$ 340"): one bill per installment, monthly,
// all sharing `installment_group_id` so the screen can show "2/3" and remove the unpaid ones together.
async function createInstallments(user, body, allowedIds) {
  const { school_id, supplier_id, description, category, first_due_date, count, total_amount, installment_amount } = body;
  requireId(school_id, 'school_id');
  checkAllowed(allowedIds, school_id);
  if (!String(description || '').trim()) throw new InputError('descrição é obrigatória');
  if (supplier_id) {
    requireId(supplier_id, 'supplier_id');
    if (!(await Supplier.exists({ _id: supplier_id }))) throw new InputError('fornecedor não encontrado');
  }
  const { total, installments } = buildInstallments({ total: total_amount, installmentAmount: installment_amount, count, firstDueDate: first_due_date });
  const installment_group_id = randomUUID();
  const docs = await Bill.insertMany(installments.map((p) => ({
    school_id, supplier_id: supplier_id || null, description: String(description).trim(), category: category || 'Outros',
    period: p.period, due_date: p.due_date, amount: p.amount,
    installment_group_id, installment_no: p.number, installment_count: p.count,
  })));
  await audit(user, 'bills.installments', { entity: 'bills', entity_id: docs[0]._id, school_id, after: { description: String(description).trim(), parcelas: installments.length, total, primeira: installments[0].amount } });
  return { installment_group_id, count: installments.length, total, ids: docs.map((d) => String(d._id)) };
}

async function payBill(user, id, { amount_paid, paid_at, payment_method }) {
  const bill = await Bill.findById(id);
  if (!bill) throw new InputError('conta não encontrada', 404);
  if (bill.paid_at) throw new InputError('esta conta já está paga');
  const amount = Number(amount_paid ?? bill.amount);
  if (!(amount > 0)) throw new InputError('valor pago deve ser maior que zero');
  const date = paid_at || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new InputError('paid_at inválido (use AAAA-MM-DD)');
  const entry = await Entry.create({
    school_id: bill.school_id, date, type: 'expense', category: bill.category, one_off: 0,
    description: bill.description, amount, bill_id: bill._id,
  });
  bill.paid_at = date; bill.amount_paid = amount; bill.payment_method = payment_method || '';
  await bill.save();
  await audit(user, 'bill.pay', { entity: 'bills', entity_id: bill._id, school_id: bill.school_id, after: { description: bill.description, amount_paid: amount, paid_at: date } });
  return { ok: true, entry_id: String(entry._id) };
}

async function undoBillPayment(user, id) {
  const bill = await Bill.findById(id);
  if (!bill) throw new InputError('conta não encontrada', 404);
  if (!bill.paid_at) throw new InputError('esta conta não está paga');
  await Entry.deleteOne({ bill_id: bill._id });
  const before = { description: bill.description, amount_paid: bill.amount_paid, paid_at: bill.paid_at };
  bill.paid_at = null; bill.amount_paid = null; bill.payment_method = '';
  await bill.save();
  await audit(user, 'bill.undo_pay', { entity: 'bills', entity_id: bill._id, school_id: bill.school_id, before });
  return { ok: true };
}

async function billsPanel(schoolParam, days, allowedIds = null) {
  const filter = schoolParam === 'all' ? (allowedIds ? { school_id: { $in: allowedIds } } : {}) : { school_id: requireId(schoolParam, 'school') };
  const [bills, schools] = await Promise.all([Bill.find(filter).lean(), School.find().select('name').lean()]);
  const names = new Map(schools.map((e) => [String(e._id), e.name]));
  const today = new Date().toISOString().slice(0, 10);
  const r = dueSummary(bills, today, days);
  const withSchoolName = (b) => ({ ...b, id: String(b._id), school: names.get(String(b.school_id)) });
  return { today, totalOverdue: r.totalOverdue, totalUpcoming: r.totalUpcoming, overdue: r.overdue.map(withSchoolName), upcoming: r.upcoming.map(withSchoolName) };
}

// Generates the month's tuition charges for a school, from its privately-funded children. Idempotent:
// tries to insert all of them and ignores the ones that already exist (unique child_id+period index).
async function generateTuition({ school_id, period }) {
  requireId(school_id, 'school_id');
  if (!/^\d{4}-\d{2}$/.test(period || '')) throw new InputError('competencia inválida (use AAAA-MM)');
  const school = await School.findById(school_id).select('tuition_due_day').lean();
  if (!school) throw new InputError('escola não encontrada', 404);
  const children = await Child.find({ school_id }).lean();
  const candidates = generateMonthTuition(children, period, school.tuition_due_day || 10);
  if (!candidates.length) return { created: 0 };
  const existing = new Set((await Tuition.find({ school_id, period }).select('child_id').lean()).map((t) => String(t.child_id)));
  const fresh = candidates.filter((t) => !existing.has(String(t.child_id)));
  if (fresh.length) await Tuition.insertMany(fresh, { ordered: false });
  return { created: fresh.length };
}

async function payTuition(user, id, { amount_paid, paid_at, payment_method }) {
  const charge = await Tuition.findById(id);
  if (!charge) throw new InputError('mensalidade não encontrada', 404);
  if (charge.paid_at) throw new InputError('esta mensalidade já está paga');
  const amount = Number(amount_paid ?? calculateCharge(charge.base_amount, charge.discount));
  if (!(amount > 0)) throw new InputError('valor pago deve ser maior que zero');
  const date = paid_at || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new InputError('paid_at inválido (use AAAA-MM-DD)');
  const entry = await Entry.create({
    school_id: charge.school_id, date, type: 'revenue', category: 'Mensalidades', one_off: 0,
    description: `Mensalidade ${charge.period}`, amount, tuition_id: charge._id,
  });
  charge.paid_at = date; charge.amount_paid = amount; charge.payment_method = payment_method || '';
  await charge.save();
  await audit(user, 'tuition.pay', { entity: 'tuition', entity_id: charge._id, school_id: charge.school_id, after: { period: charge.period, amount_paid: amount, paid_at: date } });
  return { ok: true, entry_id: String(entry._id) };
}

async function undoTuitionPayment(user, id) {
  const charge = await Tuition.findById(id);
  if (!charge) throw new InputError('mensalidade não encontrada', 404);
  if (!charge.paid_at) throw new InputError('esta mensalidade não está paga');
  await Entry.deleteOne({ tuition_id: charge._id });
  const before = { period: charge.period, amount_paid: charge.amount_paid, paid_at: charge.paid_at };
  charge.paid_at = null; charge.amount_paid = null; charge.payment_method = '';
  await charge.save();
  await audit(user, 'tuition.undo_pay', { entity: 'tuition', entity_id: charge._id, school_id: charge.school_id, before });
  return { ok: true };
}

async function tuitionPanel(schoolParam, allowedIds = null) {
  const schoolFilter = schoolParam === 'all' ? (allowedIds ? { school_id: { $in: allowedIds } } : {}) : { school_id: requireId(schoolParam, 'school') };
  const [charges, schools, children] = await Promise.all([
    Tuition.find(schoolFilter).lean(),
    School.find().select('name').lean(),
    Child.find().select('name guardian_name guardian_phone').lean(),
  ]);
  const schoolNames = new Map(schools.map((e) => [String(e._id), e.name]));
  const childrenById = new Map(children.map((c) => [String(c._id), c]));
  const today = new Date().toISOString().slice(0, 10);
  const delinquencyInfo = delinquency(charges, today);
  const debtors = charges
    .filter((t) => !t.paid_at && t.due_date < today)
    .map((t) => {
      const child = childrenById.get(String(t.child_id)) || { name: '(criança removida)' };
      return {
        id: String(t._id), child: child.name, school: schoolNames.get(String(t.school_id)),
        period: t.period, due_date: t.due_date, amount: calculateCharge(t.base_amount, t.discount),
        bracket: overdueBracket(t.due_date, today, false),
        message: chargeMessage(t, child, schoolNames.get(String(t.school_id)) || ''),
      };
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  return { today, totalDue: delinquencyInfo.totalDue, totalOverdue: delinquencyInfo.totalOverdue, delinquencyPct: delinquencyInfo.pct, debtors };
}

async function severanceInput(q, allowedIds) {
  const employee = await Employee.findById(requireId(q.get('employee_id'), 'employee_id')).lean();
  if (!employee) throw new InputError('colaborador não encontrado', 404);
  checkAllowed(allowedIds, employee.school_id);
  if (!employee.hire_date) throw new InputError('cadastre a data de admissão do colaborador');
  return { employee, input: {
    salary: employee.salary, hire_date: employee.hire_date, termination_date: q.get('date'), type: q.get('type'),
    notice: q.get('notice') || 'paid_in_lieu', notice_worked: q.get('notice_worked') !== '0',
    vacation_periods_taken: employee.vacation_periods_taken || 0, fgts_balance: employee.fgts_balance,
  } };
}

async function simulateSeverance(q, allowedIds) {
  const { employee, input } = await severanceInput(q, allowedIds);
  return { employee: { id: String(employee._id), name: employee.name }, ...calculateSeverance(input) };
}

// Terminates the employee and posts the severance cost as a one-off expense in the month.
async function applySeverance(actor, body, allowedIds) {
  const q = new URLSearchParams(body);
  const { employee, input } = await severanceInput(q, allowedIds);
  const result = calculateSeverance(input);
  await Employee.updateOne({ _id: employee._id }, { $set: { active: 0, termination_date: input.termination_date } });
  await Entry.create({
    school_id: employee.school_id, date: input.termination_date, type: 'expense', category: 'Rescisão', one_off: 1,
    description: `${SEVERANCE_TYPES[input.type]} — ${employee.name}`, amount: result.schoolCost,
  });
  await audit(actor, 'severance.apply', { entity: 'Employee', entity_id: employee._id, school_id: employee.school_id, before: { active: true }, after: { active: false, type: input.type, schoolCost: result.schoolCost } });
  return { ok: true, schoolCost: result.schoolCost };
}

// Imports an OFX statement: parses it, drops transactions already imported (by fingerprint), and
// suggests a match (open bill or open tuition charge) for every new one. Nothing is paid yet —
// suggestions are only confirmed by a human via `confirmBankTransaction`.
async function importBankStatement({ school_id, ofx }, allowedIds) {
  requireId(school_id, 'school_id');
  checkAllowed(allowedIds, school_id);
  if (typeof ofx !== 'string' || !ofx) throw new InputError('ofx (texto do arquivo) é obrigatório');
  if (!(await School.exists({ _id: school_id }))) throw new InputError('escola não encontrada', 404);
  const parsed = parseOfx(ofx);
  const withFingerprint = parsed.transactions.map((t) => ({ ...t, fingerprint: fingerprint({ schoolId: school_id, date: t.date, amount: t.amount, fitid: t.fitid }) }));
  const existing = new Set((await BankTransaction.find({ school_id, fingerprint: { $in: withFingerprint.map((t) => t.fingerprint) } }).select('fingerprint').lean()).map((t) => t.fingerprint));
  const fresh = withFingerprint.filter((t) => !existing.has(t.fingerprint));
  if (!fresh.length) return { imported: 0, duplicates: withFingerprint.length, ledgerBalance: parsed.ledgerBalance, ledgerDate: parsed.ledgerDate };
  const [bills, tuitions] = await Promise.all([
    Bill.find({ school_id, paid_at: null }).select('amount due_date').lean(),
    Tuition.find({ school_id, paid_at: null }).select('base_amount discount due_date').lean(),
  ]);
  const billPool = bills.map((b) => ({ id: String(b._id), amount: b.amount, due_date: b.due_date }));
  const tuitionPool = tuitions.map((t) => ({ id: String(t._id), amount: calculateCharge(t.base_amount, t.discount), due_date: t.due_date }));
  await BankTransaction.insertMany(fresh.map((t) => {
    const match = suggest(t, { bills: billPool, tuitions: tuitionPool });
    return {
      school_id, fitid: t.fitid, date: t.date, amount: t.amount, name: t.name, fingerprint: t.fingerprint,
      suggested_kind: match?.kind ?? null, suggested_id: match?.id ?? null,
    };
  }), { ordered: false });
  return { imported: fresh.length, duplicates: withFingerprint.length - fresh.length, ledgerBalance: parsed.ledgerBalance, ledgerDate: parsed.ledgerDate };
}

async function listBankTransactions(schoolParam, allowedIds) {
  if (schoolParam !== 'all') checkAllowed(allowedIds, requireId(schoolParam, 'school'));
  const filter = schoolParam === 'all' ? (allowedIds ? { school_id: { $in: allowedIds } } : {}) : { school_id: schoolParam };
  const docs = await BankTransaction.find(filter).sort({ date: -1, _id: -1 }).lean();
  return docs.map(({ _id, ...t }) => ({ ...t, id: String(_id) }));
}

// Confirms a transaction against a bill or tuition charge (its suggestion, or a different one the
// human picked), paying it for real, or clears the suggestion so it's treated as unmatched.
async function confirmBankTransaction(user, id, { kind, target_id }, allowedIds) {
  const tx = await BankTransaction.findById(id);
  if (!tx) throw new InputError('transação não encontrada', 404);
  checkAllowed(allowedIds, tx.school_id);
  if (tx.reconciled) throw new InputError('esta transação já foi conciliada');
  const useKind = kind ?? tx.suggested_kind;
  const useId = target_id ?? tx.suggested_id;
  if (!useKind || !useId) throw new InputError('informe kind e target_id (ou use uma transação com sugestão)');
  if (!['bill', 'tuition'].includes(useKind)) throw new InputError('kind deve ser bill ou tuition');
  requireId(useId, 'target_id');
  const paid_at = tx.date;
  const amount_paid = Math.abs(tx.amount);
  const { entry_id } = useKind === 'bill' ? await payBill(user, useId, { amount_paid, paid_at }) : await payTuition(user, useId, { amount_paid, paid_at });
  tx.reconciled = true; tx.entry_id = entry_id; tx.suggested_kind = useKind; tx.suggested_id = useId;
  await tx.save();
  await audit(user, 'bank.confirm', { entity: 'bank', entity_id: tx._id, school_id: tx.school_id, after: { kind: useKind, target_id: useId, amount: tx.amount } });
  return { ok: true, entry_id: String(entry_id) };
}

// Posts a plain entry for a transaction that doesn't match any open bill/tuition charge.
async function manualBankEntry(user, id, { category, description }, allowedIds) {
  const tx = await BankTransaction.findById(id);
  if (!tx) throw new InputError('transação não encontrada', 404);
  checkAllowed(allowedIds, tx.school_id);
  if (tx.reconciled) throw new InputError('esta transação já foi conciliada');
  const entry = await Entry.create({
    school_id: tx.school_id, date: tx.date, type: tx.amount < 0 ? 'expense' : 'revenue',
    category: category || 'Outros', description: description || tx.name, amount: Math.abs(tx.amount), one_off: 0,
  });
  await audit(user, 'bank.manual_entry', { entity: 'bank', entity_id: tx._id, school_id: tx.school_id, after: { category: entry.category, description: entry.description, amount: entry.amount } });
  tx.reconciled = true; tx.entry_id = entry._id;
  await tx.save();
  return { ok: true, entry_id: String(entry._id) };
}

async function api(req, res, url) {
  const [resource, seg2, seg3] = url.pathname.split('/').filter(Boolean).slice(1);
  const q = url.searchParams;

  if (resource === 'auth') {
    if (seg2 === 'login' && req.method === 'POST') {
      const { token, maxAgeSeconds, user } = await login(await readBody(req));
      setSessionCookie(res, token, maxAgeSeconds);
      return json(res, 200, { user });
    }
    if (seg2 === 'logout' && req.method === 'POST') {
      const token = parseCookies(req.headers.cookie).sid;
      if (token) await Session.deleteOne({ token });
      clearSessionCookie(res);
      return json(res, 200, { ok: true });
    }
    if (seg2 === 'me' && req.method === 'GET') {
      const user = await currentUser(req);
      if (!user) return json(res, 401, { error: 'sessão inválida ou ausente' });
      return json(res, 200, { user });
    }
    return json(res, 404, { error: 'rota não encontrada' });
  }

  const user = await currentUser(req);
  if (!user) return json(res, 401, { error: 'sessão inválida ou ausente' });
  const allowedIds = user.role === 'owner' ? null : user.school_ids;

  if (resource === 'users') {
    if (user.role !== 'owner') return json(res, 403, { error: 'só a dona gerencia usuários' });
    if (req.method === 'GET') return json(res, 200, await listUsers());
    if (req.method === 'POST') return json(res, 201, await createUser(user, await readBody(req)));
    if (seg2 && req.method === 'PUT') return json(res, 200, await updateUser(user, requireId(seg2), await readBody(req)));
    if (seg2 && req.method === 'DELETE') return json(res, 200, await deleteUser(user, requireId(seg2)));
    return json(res, 405, { error: 'método não suportado' });
  }

  if (resource === 'audit' && req.method === 'GET') {
    if (user.role !== 'owner') return json(res, 403, { error: 'só a dona vê a auditoria' });
    const filter = {};
    if (q.get('entity_id')) filter.entity_id = requireId(q.get('entity_id'), 'entity_id');
    if (q.get('school_id')) filter.school_id = requireId(q.get('school_id'), 'school_id');
    const logs = await AuditLog.find(filter).sort({ at: -1, _id: -1 }).limit(500).lean();
    return json(res, 200, logs.map(({ _id, ...l }) => ({ ...l, id: String(_id) })));
  }

  if (resource === 'report') return json(res, 200, await buildReport(requireYear(q.get('year') ?? new Date().getFullYear()), q.get('school') || 'all', allowedIds));

  if (resource === 'statement' && req.method === 'GET') {
    const report = await buildReport(requireYear(q.get('year') ?? new Date().getFullYear()), q.get('school') || 'all', allowedIds);
    return json(res, 200, buildStatement(report));
  }

  if (resource === 'metrics' && req.method === 'GET') {
    const year = requireYear(q.get('year') ?? new Date().getFullYear());
    const schoolParam = q.get('school') || 'all';
    const today = new Date().toISOString().slice(0, 10);
    const activeCount = async (schoolId) => (await Child.find({ school_id: schoolId }).select('enrollment_date exit_date').lean()).filter((c) => isActiveOn(c, today)).length;

    if (schoolParam !== 'all') {
      requireId(schoolParam, 'school');
      checkAllowed(allowedIds, schoolParam);
      const [report, activeChildren] = await Promise.all([buildReport(year, schoolParam), activeCount(schoolParam)]);
      return json(res, 200, buildMetrics({ report, activeChildren }));
    }

    const schools = await School.find(allowedIds ? { _id: { $in: allowedIds } } : {}).sort('_id').lean();
    const perSchool = await Promise.all(schools.map(async (s) => {
      const [report, activeChildren] = await Promise.all([buildReport(year, String(s._id)), activeCount(s._id)]);
      return { id: String(s._id), name: s.name, ...buildMetrics({ report, activeChildren }) };
    }));
    const consolidatedReport = await buildReport(year, 'all', allowedIds);
    const totalActiveChildren = perSchool.reduce((s, x) => s + x.activeChildren, 0);
    const consolidated = buildMetrics({ report: consolidatedReport, activeChildren: totalActiveChildren });
    const rows = { costPerChild: 'lower', revenuePerChild: 'higher', payrollOverRevenue: 'lower', breakEven: 'lower', margin: 'higher' };
    const winners = {};
    for (const key of Object.keys(rows)) winners[key] = betterSchool(perSchool.map((s) => ({ id: s.id, value: s[key] })), rows[key]);
    return json(res, 200, { schools: perSchool, consolidated, winners });
  }

  if (resource === 'alerts' && req.method === 'GET') {
    const year = requireYear(q.get('year') ?? new Date().getFullYear());
    const schoolId = requireId(q.get('school_id'), 'school_id');
    checkAllowed(allowedIds, schoolId);
    const today = new Date().toISOString().slice(0, 10);
    const [report, employees, bills] = await Promise.all([
      buildReport(year, schoolId),
      Employee.find({ school_id: schoolId }).lean(),
      Bill.find({ school_id: schoolId }).lean(),
    ]);
    const currentMonth = Number(today.slice(0, 4)) === year ? Number(today.slice(5, 7)) : 0;
    return json(res, 200, generateAlerts({ employees, bills, months: report.months, today, currentMonth }));
  }

  if (resource === 'export') {
    if (req.method !== 'GET') return json(res, 405, { error: 'método não suportado' });
    const schoolId = requireId(q.get('school_id'), 'school_id');
    checkAllowed(allowedIds, schoolId);

    if (seg2 === 'payroll') {
      const period = q.get('period');
      if (!/^\d{4}-\d{2}$/.test(period || '')) throw new InputError('period inválido (use AAAA-MM)');
      const employees = await Employee.find({ school_id: schoolId }).lean();
      return sendCsv(res, `folha-${period}.csv`, toCsv(payrollRows(employees, period), PAYROLL_COLUMNS));
    }
    if (seg2 === 'statement') {
      const year = requireYear(q.get('year') ?? new Date().getFullYear());
      const report = await buildReport(year, schoolId);
      return sendCsv(res, `dre-${year}.csv`, toCsv(statementRows(buildStatement(report)), STATEMENT_COLUMNS));
    }
    if (seg2 === 'bills') {
      const period = q.get('period') || null;
      if (period && !/^\d{4}-\d{2}$/.test(period)) throw new InputError('period inválido (use AAAA-MM)');
      const bills = await Bill.find({ school_id: schoolId }).lean();
      return sendCsv(res, `contas-pagas${period ? `-${period}` : ''}.csv`, toCsv(paidBillsRows(bills, period), BILLS_COLUMNS));
    }
    if (seg2 === 'entries') {
      const year = requireYear(q.get('year') ?? new Date().getFullYear());
      const entries = await Entry.find({ school_id: schoolId, date: { $regex: `^${year}-` } }).sort({ date: -1, _id: -1 }).lean();
      return sendCsv(res, `lancamentos-${year}.csv`, toCsv(entriesRows(entries), ENTRIES_COLUMNS));
    }
    return json(res, 404, { error: 'exportação não encontrada' });
  }

  if (resource === 'bills' && (seg2 === 'generate' || seg2 === 'installments' || seg2 === 'panel' || seg3 === 'pay' || seg3 === 'undo')) {
    if (seg2 === 'generate' && req.method === 'POST') { const body = await readBody(req); checkAllowed(allowedIds, requireId(body.school_id, 'school_id')); return json(res, 201, await generateBills(body)); }
    if (seg2 === 'installments' && req.method === 'POST') return json(res, 201, await createInstallments(user, await readBody(req), allowedIds));
    if (seg2 === 'panel' && req.method === 'GET') { const schoolParam = q.get('school') || 'all'; if (schoolParam !== 'all') checkAllowed(allowedIds, requireId(schoolParam, 'school')); return json(res, 200, await billsPanel(schoolParam, Number(q.get('days')) || 7, allowedIds)); }
    if (seg3 === 'pay' && req.method === 'POST') { const bill = await Bill.findById(requireId(seg2)).select('school_id').lean(); if (!bill) return json(res, 404, { error: 'conta não encontrada' }); checkAllowed(allowedIds, bill.school_id); return json(res, 200, await payBill(user, seg2, await readBody(req))); }
    if (seg3 === 'undo' && req.method === 'POST') { const bill = await Bill.findById(requireId(seg2)).select('school_id').lean(); if (!bill) return json(res, 404, { error: 'conta não encontrada' }); checkAllowed(allowedIds, bill.school_id); return json(res, 200, await undoBillPayment(user, seg2)); }
    return json(res, 405, { error: 'método não suportado' });
  }

  if (resource === 'tuition' && (seg2 === 'generate' || seg2 === 'panel' || seg3 === 'pay' || seg3 === 'undo')) {
    if (seg2 === 'generate' && req.method === 'POST') { const body = await readBody(req); checkAllowed(allowedIds, requireId(body.school_id, 'school_id')); return json(res, 201, await generateTuition(body)); }
    if (seg2 === 'panel' && req.method === 'GET') { const schoolParam = q.get('school') || 'all'; if (schoolParam !== 'all') checkAllowed(allowedIds, requireId(schoolParam, 'school')); return json(res, 200, await tuitionPanel(schoolParam, allowedIds)); }
    if (seg3 === 'pay' && req.method === 'POST') { const charge = await Tuition.findById(requireId(seg2)).select('school_id').lean(); if (!charge) return json(res, 404, { error: 'mensalidade não encontrada' }); checkAllowed(allowedIds, charge.school_id); return json(res, 200, await payTuition(user, seg2, await readBody(req))); }
    if (seg3 === 'undo' && req.method === 'POST') { const charge = await Tuition.findById(requireId(seg2)).select('school_id').lean(); if (!charge) return json(res, 404, { error: 'mensalidade não encontrada' }); checkAllowed(allowedIds, charge.school_id); return json(res, 200, await undoTuitionPayment(user, seg2)); }
    return json(res, 405, { error: 'método não suportado' });
  }

  if (resource === 'children' && seg2 === 'occupancy') {
    if (req.method !== 'GET') return json(res, 405, { error: 'método não suportado' });
    const schoolId = requireId(q.get('school_id'), 'school_id');
    checkAllowed(allowedIds, schoolId);
    const school = await School.findById(schoolId).select('capacity').lean();
    if (!school) return json(res, 404, { error: 'escola não encontrada' });
    const children = await Child.find({ school_id: schoolId }).select('enrollment_date exit_date').lean();
    return json(res, 200, occupancy(children, school.capacity, new Date().toISOString().slice(0, 10)));
  }

  if (resource === 'scenarios' && seg2 === 'simulate') {
    if (req.method !== 'POST') return json(res, 405, { error: 'método não suportado' });
    const body = await readBody(req);
    if (body.school_id) checkAllowed(allowedIds, requireId(body.school_id, 'school_id'));
    return json(res, 200, await simulateScenario(body));
  }

  if (resource === 'bank') {
    if (seg2 === 'import' && req.method === 'POST') return json(res, 201, await importBankStatement(await readBody(req), allowedIds));
    if (seg2 === 'list' && req.method === 'GET') return json(res, 200, await listBankTransactions(q.get('school') || 'all', allowedIds));
    if (seg3 === 'confirm' && req.method === 'POST') return json(res, 200, await confirmBankTransaction(user, requireId(seg2), await readBody(req), allowedIds));
    if (seg3 === 'manual' && req.method === 'POST') return json(res, 200, await manualBankEntry(user, requireId(seg2), await readBody(req), allowedIds));
    return json(res, 405, { error: 'método não suportado' });
  }

  const id = seg2 && seg3 === undefined ? requireId(seg2) : undefined;

  if (resource === 'calendar') {
    const schoolId = requireId(q.get('school_id'), 'school_id');
    checkAllowed(allowedIds, schoolId);
    const year = requireYear(q.get('year'));
    if (req.method === 'PUT') {
      const { month, factor, closed, school_days } = await readBody(req);
      if (!Number.isInteger(month) || month < 1 || month > 12) throw new InputError('mes deve ser um inteiro de 1 a 12');
      if (factor !== undefined && !(Number(factor) >= 0 && Number(factor) <= 1)) throw new InputError('fator deve estar entre 0 e 1');
      if (school_days !== undefined && school_days !== null && !(Number(school_days) >= 0 && Number(school_days) <= 31)) throw new InputError('dias_letivos deve estar entre 0 e 31');
      const set = {};
      if (factor !== undefined) set.factor = Math.min(1, Math.max(0, Number(factor)));
      if (closed !== undefined) set.closed = !!closed;
      if (school_days !== undefined) set.school_days = school_days === null ? null : Number(school_days);
      await Calendar.updateOne({ school_id: schoolId, year, month }, { $set: set });
      return json(res, 200, { ok: true });
    }
    await ensureCalendar(schoolId, year);
    return json(res, 200, await Calendar.find({ school_id: schoolId, year }).sort('month').select('month factor closed school_days -_id').lean());
  }

  if (resource === 'split' && req.method === 'POST') {
    if (user.role !== 'owner') throw new InputError('só a dona pode dividir uma compra entre as escolas', 403);
    return json(res, 201, await splitAmount(user, await readBody(req)));
  }

  if (resource === 'severance') {
    if (req.method === 'GET') return json(res, 200, await simulateSeverance(q, allowedIds));
    if (req.method === 'POST') return json(res, 201, await applySeverance(user, await readBody(req), allowedIds));
  }

  const resourceDef = RESOURCES[resource];
  if (!resourceDef) return json(res, 404, { error: 'recurso não encontrado' });
  const { model, cols } = resourceDef;
  const scoped = !['schools', 'suppliers'].includes(resource);

  if (req.method === 'GET') {
    const filter = {};
    if (resource === 'schools') { if (allowedIds) filter._id = { $in: allowedIds }; }
    else if (scoped) {
      if (q.get('school_id')) { checkAllowed(allowedIds, requireId(q.get('school_id'), 'school_id')); filter.school_id = q.get('school_id'); }
      else if (allowedIds) filter.school_id = { $in: allowedIds };
    }
    if (resource === 'entries' && q.get('year')) filter.date = { $regex: `^${requireYear(q.get('year'))}-` };
    if (['bills', 'tuition'].includes(resource) && q.get('period')) filter.period = q.get('period');
    const hasDueDate = ['bills', 'tuition'].includes(resource);
    const order = resource === 'entries' ? { date: -1, _id: -1 } : hasDueDate ? { due_date: 1, _id: 1 } : { _id: 1 };
    if (!hasDueDate) return json(res, 200, await model.find(filter).sort(order));
    const today = new Date().toISOString().slice(0, 10);
    const docs = await model.find(filter).sort(order).lean();
    return json(res, 200, docs.map(({ _id, ...c }) => ({
      ...c, id: String(_id),
      status: resource === 'bills' ? billStatus(c, today) : (c.paid_at ? 'paid' : overdueBracket(c.due_date, today, false)),
    })));
  }
  if (req.method === 'POST') {
    if (resource === 'schools' && user.role !== 'owner') throw new InputError('só a dona pode cadastrar uma nova escola', 403);
    const data = pickFields(cols, await readBody(req));
    if (scoped && data.school_id) checkAllowed(allowedIds, requireId(data.school_id, 'school_id'));
    await resourceDef.validate?.(data);
    const doc = await model.create(data);
    await audit(user, `${resource}.create`, { entity: resource, entity_id: doc._id, school_id: doc.school_id ?? (resource === 'schools' ? doc._id : null), after: docSummary(resource, doc) });
    return json(res, 201, { id: String(doc._id) });
  }
  if (req.method === 'PUT' && id) {
    if (resource === 'schools') checkAllowed(allowedIds, id);
    const data = pickFields(cols, await readBody(req));
    const existing = await model.findById(id).lean();
    if (!existing) return json(res, 404, { error: 'não encontrado' });
    if (scoped) { checkAllowed(allowedIds, existing.school_id); if (data.school_id) checkAllowed(allowedIds, requireId(data.school_id, 'school_id')); }
    await resourceDef.validate?.(data, existing);
    await model.updateOne({ _id: id }, { $set: data }, { runValidators: true });
    const { before, after, hasChanges } = changedFields(data, existing);
    if (hasChanges) {
      await audit(user, `${resource}.update`, { entity: resource, entity_id: id, school_id: existing.school_id ?? (resource === 'schools' ? id : null), before, after });
    }
    return json(res, 200, { ok: true });
  }
  if (req.method === 'DELETE' && id) {
    if (resource === 'schools') return json(res, 400, { error: 'não é possível excluir escolas' });
    const doc = await model.findById(id);
    if (!doc) return json(res, 404, { error: 'não encontrado' });
    if (scoped) checkAllowed(allowedIds, doc.school_id);
    if (q.get('installments') && doc.installment_group_id) {
      const removed = await model.deleteMany({ installment_group_id: doc.installment_group_id, paid_at: null });
      await audit(user, 'bills.installments_delete', { entity: 'bills', entity_id: doc._id, school_id: doc.school_id, before: { description: doc.description, parcelas_removidas: removed.deletedCount } });
      return json(res, 200, { ok: true, removed: removed.deletedCount });
    }
    if (q.get('group') && doc.group_id) {
      const removed = await model.deleteMany({ group_id: doc.group_id });
      await audit(user, `${resource}.delete`, { entity: resource, entity_id: doc._id, school_id: doc.school_id, before: { ...docSummary(resource, doc), group_id: doc.group_id, group_removed: removed.deletedCount } });
      return json(res, 200, { ok: true, removed: removed.deletedCount });
    }
    const removedDoc = await model.findOneAndDelete({ _id: id });
    if (!removedDoc) return json(res, 404, { error: 'não encontrado' });
    await audit(user, `${resource}.delete`, { entity: resource, entity_id: id, school_id: removedDoc.school_id, before: docSummary(resource, removedDoc) });
    return json(res, 200, { ok: true });
  }
  json(res, 405, { error: 'método não suportado' });
}

const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

export function createApp() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const origin = req.headers.origin;
    if (url.pathname.startsWith('/api/') && isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
      });
      return res.end();
    }
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (url.pathname === '/' && !(await currentUser(req))) {
        res.writeHead(302, { Location: '/login.html' });
        return res.end();
      }
      const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
      const filePath = join(PUBLIC, rel);
      if (rel.includes('..') || !filePath.startsWith(PUBLIC)) return json(res, 400, { error: 'caminho inválido' });
      const buf = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(rel)] || 'application/octet-stream' });
      res.end(buf);
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'EISDIR') return json(res, 404, { error: 'não encontrado' });
      const isInputError = e instanceof InputError || e.name === 'ValidationError' || e.name === 'CastError';
      if (!isInputError) console.error(e);
      json(res, e.status ?? (isInputError ? 400 : 500), { error: isInputError ? validationMessage(e) : 'erro interno' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await connect();
  createApp().listen(PORT, HOST, () => console.log(`Controle das Escolas em http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}`));
}
