// Warns before the problem happens: vacation about to expire (double-pay risk), a bill running well
// above its recent average, and negative cash coming up. Computed on demand — no scheduler, always
// current as of `today`.
import { daysInMonth } from './dates';
import type { BillInput, EmployeeInput, Iso, Period } from './types';

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const brl = (n: number | undefined): string => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export type AlertLevel = 'critical' | 'warning';
export interface Alert { level: AlertLevel; title: string; detail: string; action: 'employees' | 'bills' | 'dashboard' }

function addMonthsISO(iso: Iso, n: number): Iso {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, daysInMonth(ny, nm))).padStart(2, '0')}`;
}
const daysBetween = (a: Iso, b: Iso): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const previousPeriods = (period: Period, n: number): Period[] => {
  const [y, m] = period.split('-').map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const t = y * 12 + (m - 1) - (i + 1);
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  });
};

// Deadline to send the employee on vacation before the next period risks a double payment: the
// acquisition period ends 12 months after the last one taken, and there's a further 12-month
// concession window — same rule severance warns about.
export function vacationAlerts(employees: EmployeeInput[], today: Iso): Alert[] {
  const alerts: Alert[] = [];
  for (const e of employees) {
    if (!e.active || !e.hire_date) continue;
    const taken = e.vacation_periods_taken || 0;
    const deadline = addMonthsISO(e.hire_date, 12 * (taken + 2));
    const days = daysBetween(today, deadline);
    if (days > 60) continue;
    alerts.push({
      level: days < 0 ? 'critical' : 'warning',
      title: `Férias de ${e.name} vencendo`,
      detail: days < 0
        ? `O prazo passou há ${-days} dia(s): risco de pagamento em dobro. Confirme com a contabilidade.`
        : `Faltam ${days} dia(s) para o prazo — depois disso, risco de pagamento em dobro.`,
      action: 'employees',
    });
  }
  return alerts;
}

// A bill running noticeably above its own category's recent average — checked against whatever
// prior periods are actually on file (up to 3); skipped with no history to compare against.
export function billAboveAverageAlerts(bills: Pick<BillInput, 'category' | 'period' | 'amount'>[], currentPeriod: Period): Alert[] {
  const byCategory = new Map<string, Map<string, number>>();
  for (const b of bills) {
    let periods = byCategory.get(b.category);
    if (!periods) { periods = new Map(); byCategory.set(b.category, periods); }
    periods.set(b.period, (periods.get(b.period) || 0) + b.amount);
  }
  const alerts: Alert[] = [];
  for (const [category, periods] of byCategory) {
    const current = periods.get(currentPeriod);
    if (!current) continue;
    const priorAmounts = previousPeriods(currentPeriod, 3).map((p) => periods.get(p)).filter((v): v is number => v != null);
    if (!priorAmounts.length) continue;
    const average = priorAmounts.reduce((s, v) => s + v, 0) / priorAmounts.length;
    if (!(average > 0)) continue;
    const pctAbove = (current - average) / average;
    if (pctAbove <= 0.2) continue;
    alerts.push({
      level: 'warning',
      title: `Conta de ${category} acima da média`,
      detail: `${brl(current)} neste mês, ${Math.round(pctAbove * 100)}% acima da média recente (${brl(average)}).`,
      action: 'bills',
    });
  }
  return alerts;
}

// Negative cash coming up in the next 3 months (within the same year's report). `currentMonth` is
// 1–12, or falsy to skip this check entirely (e.g. the report isn't for the current year).
export function negativeCashAlerts(months: { balance: number }[], currentMonth: number): Alert[] {
  if (!currentMonth) return [];
  const alerts: Alert[] = [];
  for (let m = currentMonth + 1; m <= Math.min(12, currentMonth + 3); m++) {
    const month = months[m - 1];
    if (month && month.balance < 0) {
      alerts.push({
        level: 'critical',
        title: `Caixa negativo previsto em ${MONTH_NAMES[m - 1]}`,
        detail: `Saldo projetado de ${brl(month.balance)}.`,
        action: 'dashboard',
      });
    }
  }
  return alerts;
}

export function generateAlerts({ employees = [], bills = [], months = [], today, currentMonth = 0 }: {
  employees?: EmployeeInput[];
  bills?: Pick<BillInput, 'category' | 'period' | 'amount'>[];
  months?: { balance: number }[];
  today: Iso;
  currentMonth?: number;
}): Alert[] {
  return [
    ...vacationAlerts(employees, today),
    ...billAboveAverageAlerts(bills, today.slice(0, 7)),
    ...negativeCashAlerts(months, currentMonth),
  ];
}
