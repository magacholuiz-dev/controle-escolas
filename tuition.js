// Tuition for privately-funded slots: generation per period, discount, lateness and billing. Pure function.
import { InputError } from './errors.js';
import { activeFractionInMonth } from './children.js';

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const utc = (iso) => Date.UTC(...iso.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)));
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);

export function calculateCharge(baseAmount, discount = 0) {
  return Math.max(0, Math.round((baseAmount - discount) * 100) / 100);
}

// Due date for the billing period, day clamped to the month's real length.
export function dueDateForMonth(period, day = 10) {
  const m = /^(\d{4})-(\d{2})$/.exec(period || '');
  if (!m) throw new InputError(`competência inválida: ${period}`);
  const year = +m[1], month = +m[2];
  const d = Math.min(Math.max(1, day), daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// One tuition charge per child with a `private` slot active in the period (same "active" criterion
// as Loop 2: a positive day fraction). Who already has one (by `child_id`) isn't filtered here — the
// real idempotency is the unique index in the database; this function only decides WHO should have one.
export function generateMonthTuition(children, period, dueDay = 10) {
  const [year, month] = period.split('-').map(Number);
  return children
    .filter((c) => c.enrollment_type === 'private' && activeFractionInMonth(c, year, month) > 0)
    .map((c) => ({
      school_id: c.school_id,
      child_id: c._id,
      period,
      base_amount: c.tuition_amount || 0,
      discount: 0,
      due_date: dueDateForMonth(period, dueDay),
    }))
    .filter((t) => t.base_amount > 0);
}

// Overdue bracket. A paid charge is never overdue, even past its due date.
export function overdueBracket(dueDate, today, paid = false) {
  if (paid) return 'current';
  const daysLate = daysBetween(dueDate, today);
  if (daysLate <= 0) return 'current';
  if (daysLate <= 30) return '1-30';
  if (daysLate <= 60) return '31-60';
  return '60+';
}

// Delinquency for the period: amount overdue ÷ amount of everything already due (paid or not).
export function delinquency(charges, today) {
  const amountOf = (t) => calculateCharge(t.base_amount, t.discount);
  const due = charges.filter((t) => t.due_date <= today);
  const overdue = due.filter((t) => !t.paid_at);
  const totalDue = due.reduce((s, t) => s + amountOf(t), 0);
  const totalOverdue = overdue.reduce((s, t) => s + amountOf(t), 0);
  return { totalDue, totalOverdue, pct: totalDue > 0 ? totalOverdue / totalDue : null };
}

// Billing message, with no sensitive data (never CPF).
export function chargeMessage(charge, child, schoolName) {
  const amount = calculateCharge(charge.base_amount, charge.discount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const [year, month] = charge.period.split('-');
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const guardianPrefix = child.guardian_name ? `${child.guardian_name}, ` : '';
  return `Olá, ${guardianPrefix}a mensalidade de ${child.name} (${schoolName}) referente a ${MONTHS[+month - 1]}/${year} está no valor de ${amount}, com vencimento em ${charge.due_date.split('-').reverse().join('/')}.`;
}
