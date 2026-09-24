// Turns a list of adjustments into new inputs for calc.js's `calculateSchool`, without touching the
// real employees/expenses/entries the caller passed in. Pure function: never talks to the database,
// never throws on a bad adjustment — a bad one becomes a warning so one mistake doesn't sink the
// whole simulation.
import { calculateSeverance } from './severance.js';

export const ADJUSTMENT_TYPES = ['delay_transfer', 'hire', 'terminate', 'cut_expense'];

export function applyAdjustments(inputs, adjustments = []) {
  let employees = [...inputs.employees];
  let expenses = [...inputs.expenses];
  let entries = [...inputs.entries];
  let revenueDelayMonths = inputs.revenueDelayMonths || 0;
  const warnings = [];

  for (const adj of adjustments || []) {
    if (!adj || !ADJUSTMENT_TYPES.includes(adj.type)) { warnings.push(`ajuste desconhecido: ${adj?.type ?? adj}`); continue; }

    if (adj.type === 'delay_transfer') {
      const months = Math.round(Number(adj.months));
      if (!(months > 0)) { warnings.push('delay_transfer precisa de "months" maior que zero'); continue; }
      revenueDelayMonths += months;
    }

    else if (adj.type === 'hire') {
      const salary = Number(adj.salary);
      if (!(salary > 0)) { warnings.push('hire precisa de "salary" maior que zero'); continue; }
      employees = [...employees, {
        _id: `scenario-hire-${employees.length}`, salary, benefits: Number(adj.benefits) || 0, active: 1,
        hire_date: adj.hire_date || null, vacation_periods_taken: 0, fgts_balance: null,
      }];
    }

    else if (adj.type === 'terminate') {
      const employee = employees.find((e) => String(e._id) === String(adj.employee_id));
      if (!employee) { warnings.push(`colaborador ${adj.employee_id} não encontrado para a demissão simulada`); continue; }
      if (!employee.hire_date) { warnings.push(`colaborador ${adj.employee_id} não tem data de admissão; não é possível simular a rescisão`); continue; }
      let severance;
      try {
        severance = calculateSeverance({
          salary: employee.salary, hire_date: employee.hire_date, termination_date: adj.date, type: adj.severance_type || 'without_cause',
          vacation_periods_taken: employee.vacation_periods_taken || 0, fgts_balance: employee.fgts_balance ?? null,
        });
      } catch (e) { warnings.push(`rescisão simulada de ${adj.employee_id} inválida: ${e.message}`); continue; }
      employees = employees.map((e) => (e === employee ? { ...e, active: 0, termination_date: adj.date } : e));
      entries = [...entries, { date: adj.date, type: 'expense', category: 'Rescisão', amount: severance.schoolCost, one_off: 1 }];
    }

    else if (adj.type === 'cut_expense') {
      const pct = Number(adj.pct);
      if (!(pct > 0 && pct <= 1)) { warnings.push('cut_expense precisa de "pct" entre 0 (exclusivo) e 1'); continue; }
      if (!expenses.some((e) => e.category === adj.category)) warnings.push(`nenhuma despesa na categoria "${adj.category}" para cortar`);
      expenses = expenses.map((e) => (e.category === adj.category ? { ...e, monthly_amount: e.monthly_amount * (1 - pct) } : e));
    }
  }

  return { employees, expenses, entries, revenueDelayMonths, warnings };
}
