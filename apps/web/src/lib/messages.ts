// Every user-facing Portuguese string that is shared between screens (single locale, pt-BR).
export const APP_TITLE = 'Controle Financeiro';
export const APP_SUBTITLE = 'Escolas infantis · contrato Prefeitura de Curitiba';

export const CATEGORIES = ['Alimentação', 'Aluguel', 'Água', 'Luz', 'Internet', 'Segurança', 'Material de cozinha', 'Material de limpeza', 'Material pedagógico', 'Manutenção', 'Contabilidade', 'Rescisão', 'Outros'];
export const CATEGORY_OPTIONS: [string, string][] = CATEGORIES.map((c) => [c, c]);

export const NAV_GROUPS = ['Visão geral', 'Receitas', 'Despesas', 'Contabilidade', 'Sistema'] as const;
export interface NavItem { href: string; group: (typeof NAV_GROUPS)[number]; label: string; ownerOnly?: boolean; allSchools?: boolean }
// One route per legacy tab, grouped by task in the sidebar. `allSchools`: the screen has a meaningful consolidated view.
export const NAV: NavItem[] = [
  { href: '/painel', group: 'Visão geral', label: 'Painel', allSchools: true },
  { href: '/receitas', group: 'Receitas', label: 'Receitas' },
  { href: '/criancas', group: 'Receitas', label: 'Crianças' },
  { href: '/mensalidades', group: 'Receitas', label: 'Mensalidades' },
  { href: '/equipe', group: 'Despesas', label: 'Equipe' },
  { href: '/despesas', group: 'Despesas', label: 'Despesas' },
  { href: '/contas', group: 'Despesas', label: 'Contas a pagar' },
  { href: '/fornecedores', group: 'Despesas', label: 'Fornecedores' },
  { href: '/calendario', group: 'Sistema', label: 'Calendário de repasse' },
  { href: '/lancamentos', group: 'Contabilidade', label: 'Lançamentos reais' },
  { href: '/dre', group: 'Contabilidade', label: 'DRE', allSchools: true },
  { href: '/indicadores', group: 'Visão geral', label: 'Indicadores', allSchools: true },
  { href: '/cenarios', group: 'Visão geral', label: 'Cenários' },
  { href: '/conciliacao', group: 'Contabilidade', label: 'Conciliação bancária' },
  { href: '/parametros', group: 'Sistema', label: 'Parâmetros' },
  { href: '/usuarios', group: 'Sistema', label: 'Usuários', ownerOnly: true },
];

export const BILL_STATUS: Record<string, [string, string]> = { pending: ['Pendente', ''], overdue: ['Vencida', 'neg'], paid: ['Paga', 'pos'] };
export const TUITION_STATUS: Record<string, [string, string]> = {
  current: ['Em dia', ''], '1-30': ['Atraso 1–30 dias', 'neg'], '31-60': ['Atraso 31–60 dias', 'neg'], '60+': ['Atraso 60+ dias', 'neg'], paid: ['Paga', 'pos'],
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'employees.create': 'Cadastrou colaborador', 'employees.update': 'Editou colaborador', 'employees.delete': 'Excluiu colaborador',
  'revenues.create': 'Cadastrou receita', 'revenues.update': 'Editou receita', 'revenues.delete': 'Excluiu receita',
  'expenses.create': 'Cadastrou despesa', 'expenses.update': 'Editou despesa', 'expenses.delete': 'Excluiu despesa',
  'entries.create': 'Lançou um registro', 'entries.update': 'Editou um lançamento', 'entries.delete': 'Excluiu um lançamento',
  'schools.create': 'Cadastrou escola', 'schools.update': 'Editou parâmetros da escola',
  'children.create': 'Cadastrou criança', 'children.update': 'Editou criança', 'children.delete': 'Excluiu criança',
  'tuition.create': 'Cadastrou mensalidade', 'tuition.update': 'Editou mensalidade', 'tuition.delete': 'Excluiu mensalidade',
  'suppliers.create': 'Cadastrou fornecedor', 'suppliers.update': 'Editou fornecedor', 'suppliers.delete': 'Excluiu fornecedor',
  'scenarios.create': 'Salvou cenário', 'scenarios.delete': 'Excluiu cenário',
  'bills.create': 'Cadastrou conta a pagar', 'bills.update': 'Editou conta a pagar', 'bills.delete': 'Excluiu conta a pagar',
  'bills.installments': 'Lançou uma compra parcelada', 'bills.installments_delete': 'Excluiu as parcelas em aberto de uma compra',
  'bill.pay': 'Pagou uma conta', 'bill.undo_pay': 'Desfez o pagamento de uma conta',
  'tuition.pay': 'Pagou uma mensalidade', 'tuition.undo_pay': 'Desfez o pagamento de uma mensalidade',
  'bank.confirm': 'Confirmou uma conciliação bancária', 'bank.manual_entry': 'Lançou um movimento bancário manualmente',
  'severance.apply': 'Aplicou uma rescisão', 'user.create': 'Criou um usuário', 'user.update': 'Editou um usuário', 'user.delete': 'Excluiu um usuário',
};

export const AUDIT_FIELD_LABELS: Record<string, string> = {
  name: 'nome', description: 'descrição', amount: 'valor', monthly_amount: 'valor mensal', salary: 'salário', role: 'cargo',
  category: 'categoria', base_amount: 'valor base', discount: 'desconto', period: 'competência', kind: 'tipo', target_id: 'id',
  amount_paid: 'valor pago', paid_at: 'data do pagamento', group_id: 'grupo', group_removed: 'itens removidos do grupo', school_ids: 'escolas',
  parcelas: 'parcelas', total: 'total', primeira: '1ª parcela', parcelas_removidas: 'parcelas removidas',
};
