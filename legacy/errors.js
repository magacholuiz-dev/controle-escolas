// Error caused by invalid user input: the API responds with `status` (400 by default), never 500.
export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'InputError';
    this.status = status;
  }
}

// User-facing (Portuguese) labels for each field, used to build error messages the person can act on.
const LABELS = {
  name: 'nome', description: 'descrição', category: 'categoria', amount: 'valor', monthly_amount: 'valor mensal', date: 'data', type: 'tipo',
  school_id: 'escola', salary: 'salário', benefits: 'benefícios', hire_date: 'data de admissão', termination_date: 'data de desligamento',
  vacation_month: 'mês das férias', payroll_tax_pct: 'encargos (%)', tax_pct: 'impostos (%)', initial_balance: 'saldo inicial', children_count: 'crianças',
};
const label = (field) => LABELS[field] ?? field;

// Translates Mongoose errors into a sentence the person can act on (shown to the user, so it stays in Portuguese).
export function validationMessage(e) {
  if (e.name === 'CastError') return `Valor inválido no campo "${label(e.path)}".`;
  if (e.name !== 'ValidationError') return e.message;
  return Object.values(e.errors).map((x) => {
    const field = label(x.path);
    if (x.kind === 'required') return `Preencha o campo "${field}".`;
    if (x.kind === 'min' || x.kind === 'max') return `Valor fora da faixa permitida em "${field}".`;
    if (x.kind === 'enum') return `Valor não permitido em "${field}".`;
    return `Valor inválido no campo "${field}".`;
  }).join(' ');
}
