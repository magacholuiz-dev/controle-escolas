// Turns a list of adjustments into new inputs for calc's `calculateSchool`, without touching the
// real employees/expenses/entries the caller passed in. Never talks to the database and never
// throws on a bad adjustment — a bad one becomes a warning so one mistake doesn't sink the whole
// simulation.
import { calculateSeverance } from './severance';
import type { EmployeeInput, EntryInput, ExpenseInput } from './types';

export const ADJUSTMENT_TYPES = ['delay_transfer', 'hire', 'terminate', 'cut_expense'] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export interface Adjustment {
  type?: string;
  months?: unknown;
  salary?: unknown;
  benefits?: unknown;
  hire_date?: string | null;
  employee_id?: unknown;
  date?: string;
  severance_type?: string;
  category?: string;
  pct?: unknown;
}

export interface ScenarioBase {
  employees: EmployeeInput[];
  expenses: ExpenseInput[];
  entries: EntryInput[];
  revenueDelayMonths?: number;
}
export interface ScenarioResult {
  employees: EmployeeInput[];
  expenses: ExpenseInput[];
  entries: EntryInput[];
  revenueDelayMonths: number;
  warnings: string[];
}

export function applyAdjustments(inputs: ScenarioBase, adjustments: (Adjustment | null | undefined)[] | undefined = []): ScenarioResult {
  let employees = [...inputs.employees];
  let expenses = [...inputs.expenses];
  let entries = [...inputs.entries];
  let revenueDelayMonths = inputs.revenueDelayMonths || 0;
  const warnings: string[] = [];

  for (const adj of adjustments || []) {
    if (!adj || !(ADJUSTMENT_TYPES as readonly string[]).includes(adj.type as string)) { warnings.push(`ajuste desconhecido: ${adj?.type ?? adj}`); continue; }

    if (adj.type === 'delay_transfer') {
      const months = Math.round(Number(adj.months));
      if (!(months > 0)) { warnings.push('delay_transfer precisa de "months" maior que zero'); continue; }
      revenueDelayMonths += months;
    } else if (adj.type === 'hire') {
      const salary = Number(adj.salary);
      if (!(salary > 0)) { warnings.push('hire precisa de "salary" maior que zero'); continue; }
      employees = [...employees, {
        _id: `scenario-hire-${employees.length}`, salary, benefits: Number(adj.benefits) || 0, active: 1,
        hire_date: adj.hire_date || null, vacation_periods_taken: 0, fgts_balance: null,
      }];
    } else if (adj.type === 'terminate') {
      const employee = employees.find((e) => String(e._id) === String(adj.employee_id));
      if (!employee) { warnings.push(`colaborador ${adj.employee_id} não encontrado para a demissão simulada`); continue; }
      if (!employee.hire_date) { warnings.push(`colaborador ${adj.employee_id} não tem data de admissão; não é possível simular a rescisão`); continue; }
      let schoolCost: number;
      try {
        schoolCost = calculateSeverance({
          salary: employee.salary, hire_date: employee.hire_date, termination_date: adj.date as string, type: adj.severance_type || 'without_cause',
          vacation_periods_taken: employee.vacation_periods_taken || 0, fgts_balance: employee.fgts_balance ?? null,
        }).schoolCost;
      } catch (e) { warnings.push(`rescisão simulada de ${adj.employee_id} inválida: ${(e as Error).message}`); continue; }
      employees = employees.map((e) => (e === employee ? { ...e, active: 0, termination_date: adj.date as string } : e));
      entries = [...entries, { date: adj.date as string, type: 'expense', category: 'Rescisão', amount: schoolCost, one_off: 1 }];
    } else if (adj.type === 'cut_expense') {
      const pct = Number(adj.pct);
      if (!(pct > 0 && pct <= 1)) { warnings.push('cut_expense precisa de "pct" entre 0 (exclusivo) e 1'); continue; }
      if (!expenses.some((e) => e.category === adj.category)) warnings.push(`nenhuma despesa na categoria "${adj.category}" para cortar`);
      expenses = expenses.map((e) => (e.category === adj.category ? { ...e, monthly_amount: e.monthly_amount * (1 - pct) } : e));
    }
  }

  return { employees, expenses, entries, revenueDelayMonths, warnings };
}
