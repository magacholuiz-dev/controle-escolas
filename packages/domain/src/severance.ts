import { InputError } from './errors';
import { daysInMonth } from './dates';
// Severance (CLT) calculation per employee. Gross amounts (no employee INSS/IRRF withholding).
//
// Assumptions:
//  - 30-day commercial month; a fraction >= 15 days counts as a full month (13th salary and vacation).
//  - Proportional notice period (Law 12.506/2011): 30 days + 3 per full year, capped at 90.
//  - Pay-in-lieu notice extends the length of service (projects the date used for the 13th, vacation and FGTS).
//  - FGTS balance: if not given, estimated at 8% of salary per month worked (+13th).
//  - Not included: variable averages/overtime, advances, absences, employee INSS/IRRF.

export type SeveranceType = 'without_cause' | 'mutual_agreement' | 'resignation' | 'for_cause';
export const SEVERANCE_TYPES: Record<SeveranceType, string> = {
  without_cause: 'Demissão sem justa causa',
  mutual_agreement: 'Acordo entre as partes (art. 484-A)',
  resignation: 'Pedido de demissão',
  for_cause: 'Demissão por justa causa',
};

export interface SeveranceInput {
  salary: number;
  hire_date: string;
  termination_date: string;
  type: string;
  notice?: string;
  vacation_periods_taken?: number;
  fgts_balance?: number | null;
  notice_worked?: boolean;
}

export interface SeveranceLine { name: string; amount: number; note: string }
export interface SeveranceResult {
  type: SeveranceType;
  typeName: string;
  projectedDate: string;
  noticeDays: number;
  lines: SeveranceLine[];
  totalToEmployee: number;
  fgts: { estimatedBalance: number; severanceDeposit: number; fine: number; finePct: number; withdrawalAllowed: string };
  schoolCost: number;
  warnings: string[];
}

interface Ymd { y: number; m: number; d: number }

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const parseDate = (s: string | null | undefined): Ymd => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) throw new InputError(`data inválida: ${s}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
};
const utc = ({ y, m, d }: Ymd): number => Date.UTC(y, m - 1, d);
const addDays = (dt: Ymd, n: number): Ymd => {
  const x = new Date(utc(dt) + n * 86400000);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
};
const fmt = ({ y, m, d }: Ymd): string => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Full months between a and b (a <= b).
export const fullMonthsBetween = (a: Ymd, b: Ymd): number => (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
const addMonths = (dt: Ymd, n: number): Ymd => {
  const t = dt.y * 12 + (dt.m - 1) + n;
  const y = Math.floor(t / 12);
  const m = (t % 12) + 1;
  return { y, m, d: Math.min(dt.d, daysInMonth(y, m)) };
};
const daysBetween = (a: Ymd, b: Ymd): number => Math.round((utc(b) - utc(a)) / 86400000);

export function calculateSeverance({
  salary, hire_date, termination_date, type, notice = 'paid_in_lieu',
  vacation_periods_taken = 0, fgts_balance = null, notice_worked = true,
}: SeveranceInput): SeveranceResult {
  if (!Object.hasOwn(SEVERANCE_TYPES, type)) throw new InputError(`tipo de rescisão inválido: ${type}`);
  const severanceType = type as SeveranceType;
  const hireDate = parseDate(hire_date);
  const originalTermination = parseDate(termination_date);
  if (utc(originalTermination) < utc(hireDate)) throw new InputError('a rescisão não pode ser antes da admissão');

  const forCause = severanceType === 'for_cause';
  const dailyRate = salary / 30;
  const warnings: string[] = [];
  const lines: SeveranceLine[] = [];
  const add = (name: string, amount: number, note = ''): void => { if (amount) lines.push({ name, amount: round2(amount), note }); };

  // Notice period
  const years = Math.floor(fullMonthsBetween(hireDate, originalTermination) / 12);
  const noticeDays = Math.min(90, 30 + 3 * Math.max(0, years));
  const paidInLieu = (severanceType === 'without_cause' || severanceType === 'mutual_agreement') && notice === 'paid_in_lieu';
  const effectiveDate = paidInLieu ? addDays(originalTermination, noticeDays) : originalTermination; // projected date

  // Salary balance (days worked in the termination month)
  const balanceDays = Math.min(30, originalTermination.d);
  const salaryBalance = dailyRate * balanceDays;
  add('Saldo de salário', salaryBalance, `${balanceDays} dias`);

  let noticeAmount = 0;
  if (paidInLieu) {
    noticeAmount = dailyRate * noticeDays * (severanceType === 'mutual_agreement' ? 0.5 : 1);
    add('Aviso prévio indenizado', noticeAmount, `${noticeDays} dias${severanceType === 'mutual_agreement' ? ', 50% (acordo)' : ''}`);
  }
  if (severanceType === 'resignation' && !notice_worked) {
    add('(−) Desconto de aviso prévio não cumprido', -salary, '30 dias');
  }

  // Proportional 13th salary
  let thirteenth = 0;
  if (!forCause) {
    const firstMonth = hireDate.y === effectiveDate.y
      ? (daysInMonth(hireDate.y, hireDate.m) - hireDate.d + 1 >= 15 ? hireDate.m : hireDate.m + 1)
      : 1;
    const lastMonth = effectiveDate.d >= 15 ? effectiveDate.m : effectiveDate.m - 1;
    const twelfths = Math.max(0, lastMonth - firstMonth + 1);
    thirteenth = (salary / 12) * twelfths;
    add('13º salário proporcional', thirteenth, `${twelfths}/12`);
  }

  // Vacation
  let vestedVacation = 0;
  let proportionalVacation = 0;
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
  const finePct = severanceType === 'without_cause' ? 0.4 : severanceType === 'mutual_agreement' ? 0.2 : 0;
  const fgtsFine = (fgtsBalance + severanceFgtsDeposit) * finePct;

  const totalDue = lines.reduce((s, l) => s + l.amount, 0);
  if (fgts_balance == null) warnings.push('Saldo de FGTS estimado (8% do salário atual × meses trabalhados). Informe o saldo do extrato para o valor exato.');
  if (severanceType === 'without_cause' && notice === 'worked') warnings.push('Aviso trabalhado: o colaborador cumpre 30+ dias e a rescisão sai ao final; o valor acima é uma projeção pela data informada.');
  warnings.push('Valores brutos: não descontam INSS/IRRF do empregado, adiantamentos nem faltas.');

  return {
    type: severanceType, typeName: SEVERANCE_TYPES[severanceType],
    projectedDate: fmt(effectiveDate), noticeDays: paidInLieu || severanceType === 'without_cause' ? noticeDays : 0,
    lines,
    totalToEmployee: round2(totalDue),
    fgts: {
      estimatedBalance: round2(fgtsBalance), severanceDeposit: round2(severanceFgtsDeposit), fine: round2(fgtsFine), finePct,
      withdrawalAllowed: severanceType === 'without_cause' ? '100%' : severanceType === 'mutual_agreement' ? '80%' : 'não',
    },
    // Cost to the school: amounts owed + FGTS deposit on those amounts + fine (paid on its own form).
    schoolCost: round2(totalDue + severanceFgtsDeposit + fgtsFine),
    warnings,
  };
}
