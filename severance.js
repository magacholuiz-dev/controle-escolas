import { InputError } from './errors.js';
// Severance (CLT) calculation per employee. Pure function, gross amounts (no employee INSS/IRRF withholding).
//
// Assumptions:
//  - 30-day commercial month; a fraction >= 15 days counts as a full month (13th salary and vacation).
//  - Proportional notice period (Law 12.506/2011): 30 days + 3 per full year, capped at 90.
//  - Pay-in-lieu notice extends the length of service (projects the date used for the 13th, vacation and FGTS).
//  - FGTS balance: if not given, estimated at 8% of salary per month worked (+13th).
//  - Not included: variable averages/overtime, advances, absences, employee INSS/IRRF.

export const SEVERANCE_TYPES = {
  without_cause: 'Demissão sem justa causa',
  mutual_agreement: 'Acordo entre as partes (art. 484-A)',
  resignation: 'Pedido de demissão',
  for_cause: 'Demissão por justa causa',
};

const round2 = (n) => Math.round(n * 100) / 100;

export const parseDate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) throw new InputError(`data inválida: ${s}`);
  return { y: +m[1], m: +m[2], d: +m[3] };
};
const utc = ({ y, m, d }) => Date.UTC(y, m - 1, d);
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addDays = (dt, n) => {
  const x = new Date(utc(dt) + n * 86400000);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
};
const fmt = ({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Full months between a and b (a <= b).
export const fullMonthsBetween = (a, b) => (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
const addMonths = (dt, n) => {
  const t = dt.y * 12 + (dt.m - 1) + n;
  const y = Math.floor(t / 12), m = (t % 12) + 1;
  return { y, m, d: Math.min(dt.d, daysInMonth(y, m)) };
};
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);

export function calculateSeverance({
  salary, hire_date, termination_date, type, notice = 'paid_in_lieu',
  vacation_periods_taken = 0, fgts_balance = null, notice_worked = true,
}) {
  if (!SEVERANCE_TYPES[type]) throw new InputError(`tipo de rescisão inválido: ${type}`);
  const hireDate = parseDate(hire_date), originalTermination = parseDate(termination_date);
  if (utc(originalTermination) < utc(hireDate)) throw new InputError('a rescisão não pode ser antes da admissão');

  const forCause = type === 'for_cause';
  const dailyRate = salary / 30;
  const warnings = [];
  const lines = [];
  const add = (name, amount, note = '') => { if (amount) lines.push({ name, amount: round2(amount), note }); };

  // Notice period
  const years = Math.floor(fullMonthsBetween(hireDate, originalTermination) / 12);
  const noticeDays = Math.min(90, 30 + 3 * Math.max(0, years));
  const paidInLieu = (type === 'without_cause' || type === 'mutual_agreement') && notice === 'paid_in_lieu';
  const effectiveDate = paidInLieu ? addDays(originalTermination, noticeDays) : originalTermination; // projected date

  // Salary balance (days worked in the termination month)
  const balanceDays = Math.min(30, originalTermination.d);
  const salaryBalance = dailyRate * balanceDays;
  add('Saldo de salário', salaryBalance, `${balanceDays} dias`);

  let noticeAmount = 0;
  if (paidInLieu) {
    noticeAmount = dailyRate * noticeDays * (type === 'mutual_agreement' ? 0.5 : 1);
    add('Aviso prévio indenizado', noticeAmount, `${noticeDays} dias${type === 'mutual_agreement' ? ', 50% (acordo)' : ''}`);
  }
  if (type === 'resignation' && !notice_worked) {
    add('(−) Desconto de aviso prévio não cumprido', -salary, '30 dias');
  }

  // Proportional 13th salary
  let thirteenth = 0;
  if (!forCause) {
    const firstMonth = hireDate.y === effectiveDate.y ?
      (daysInMonth(hireDate.y, hireDate.m) - hireDate.d + 1 >= 15 ? hireDate.m : hireDate.m + 1) : 1;
    const lastMonth = effectiveDate.d >= 15 ? effectiveDate.m : effectiveDate.m - 1;
    const twelfths = Math.max(0, lastMonth - firstMonth + 1);
    thirteenth = (salary / 12) * twelfths;
    add('13º salário proporcional', thirteenth, `${twelfths}/12`);
  }

  // Vacation
  let vestedVacation = 0, proportionalVacation = 0;
  const completedPeriods = Math.floor(fullMonthsBetween(hireDate, effectiveDate) / 12);
  const overduePeriods = Math.max(0, completedPeriods - vacation_periods_taken);
  // Vested (overdue) vacation is owed even in a for-cause termination.
  if (overduePeriods > 0) {
    vestedVacation = overduePeriods * salary;
    add('Férias vencidas', vestedVacation, `${overduePeriods} período(s)`);
    add('1/3 constitucional sobre férias vencidas', vestedVacation / 3);
    // Double pay risk: a period overdue for more than 12 months without being taken.
    const accrualEnd = addMonths(hireDate, 12 * (vacation_periods_taken + 1));
    if (utc(effectiveDate) > utc(addMonths(accrualEnd, 12))) {
      warnings.push('Há período de férias vencido há mais de 12 meses: possível pagamento em dobro. Confirme com a contabilidade.');
    }
  }
  if (!forCause) {
    const lastAnniversary = addMonths(hireDate, 12 * completedPeriods);
    const fullMonthsSince = fullMonthsBetween(lastAnniversary, effectiveDate);
    const remainderDays = daysBetween(addMonths(lastAnniversary, fullMonthsSince), effectiveDate);
    const twelfths = Math.min(12, fullMonthsSince + (remainderDays >= 15 ? 1 : 0));
    proportionalVacation = (salary / 12) * twelfths;
    add('Férias proporcionais', proportionalVacation, `${twelfths}/12`);
    add('1/3 constitucional sobre férias proporcionais', proportionalVacation / 3);
  }

  // FGTS
  const fgtsMonths = Math.max(0, fullMonthsBetween(hireDate, originalTermination));
  const fgtsBalance = fgts_balance ?? salary * 0.08 * fgtsMonths * (13 / 12);
  const severanceFgtsBase = salaryBalance + noticeAmount + thirteenth;
  const severanceFgtsDeposit = forCause && !thirteenth ? salaryBalance * 0.08 : severanceFgtsBase * 0.08;
  const finePct = type === 'without_cause' ? 0.4 : type === 'mutual_agreement' ? 0.2 : 0;
  const fgtsFine = (fgtsBalance + severanceFgtsDeposit) * finePct;

  const totalDue = lines.reduce((s, l) => s + l.amount, 0);
  if (fgts_balance == null) warnings.push('Saldo de FGTS estimado (8% do salário atual × meses trabalhados). Informe o saldo do extrato para o valor exato.');
  if (type === 'without_cause' && notice === 'worked') warnings.push('Aviso trabalhado: o colaborador cumpre 30+ dias e a rescisão sai ao final; o valor acima é uma projeção pela data informada.');
  warnings.push('Valores brutos: não descontam INSS/IRRF do empregado, adiantamentos nem faltas.');

  return {
    type, typeName: SEVERANCE_TYPES[type],
    projectedDate: fmt(effectiveDate), noticeDays: paidInLieu || type === 'without_cause' ? noticeDays : 0,
    lines,
    totalToEmployee: round2(totalDue),
    fgts: { estimatedBalance: round2(fgtsBalance), severanceDeposit: round2(severanceFgtsDeposit), fine: round2(fgtsFine), finePct,
      withdrawalAllowed: type === 'without_cause' ? '100%' : type === 'mutual_agreement' ? '80%' : 'não' },
    // Cost to the school: amounts owed + FGTS deposit on those amounts + fine (paid on its own form).
    schoolCost: round2(totalDue + severanceFgtsDeposit + fgtsFine),
    warnings,
  };
}
