'use client';
import { useState } from 'react';
import type { Child, Employee, Revenue } from '@controle-escolas/contracts';
import { EditableTable } from '@/components/editable-table';
import { ExportButton } from '@/components/export-button';
import { CATEGORY_OPTIONS } from '@/lib/messages';
import { MONTHS, thisPeriod, today } from '@/lib/format';
import { useApp, useTargetSchool } from '@/lib/store';
import { useFetch } from '@/lib/useFetch';
import { Kpi, Note, Warning } from '@/components/ui';
import { monthOptions, SplitForm } from './common';
import { SeverancePanel } from './severance';
import { pct } from '@/lib/format';
import type { FieldSpec } from '@/components/fields';

const B = ({ children }: { children: React.ReactNode }) => <b>{children}</b>;

export function RevenuesScreen() {
  const school = useTargetSchool();
  return (
    <>
      <Note>Receitas recorrentes de <B>{school.name}</B>. Marque &quot;segue calendário&quot; no contrato da Prefeitura: o valor mensal é multiplicado pelo fator de repasse de cada mês (0% em janeiro e julho, 50% em fevereiro, por padrão). Mensalidades particulares normalmente não seguem o calendário.</Note>
      <EditableTable resource="revenues" query={`school_id=${school.id}`} extra={{ school_id: school.id }} defaults={{ follows_calendar: 1 }} totalKey="monthly_amount" fields={[
        { key: 'description', label: 'Descrição', type: 'text' },
        { key: 'monthly_amount', label: 'Valor mensal cheio', type: 'money' },
        { key: 'follows_calendar', label: 'Segue calendário da Prefeitura', type: 'bool' },
      ]} />
    </>
  );
}

export function EmployeesScreen() {
  const school = useTargetSchool();
  const [severanceFor, setSeveranceFor] = useState<Employee | null>(null);
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <Note>Equipe de <B>{school.name}</B>. Cadastre cada colaborador com a data de admissão para calcular a rescisão de cada um. Encargos, 13º e férias saem do salário (percentuais em Parâmetros). Benefícios (VT/VA) entram só na folha mensal. &quot;Férias já gozadas&quot; é o número de períodos aquisitivos completos que o colaborador já tirou.</Note>
      <div className="add"><ExportButton label={`Exportar folha de ${thisPeriod()} (CSV)`} path={`export/payroll?school_id=${school.id}&period=${thisPeriod()}`} /></div>
      <EditableTable resource="employees" query={`school_id=${school.id}`} extra={{ school_id: school.id }} defaults={{ active: 1, benefits: 0, vacation_periods_taken: 0 }} totalKey="salary" refreshKey={refresh} fields={[
        { key: 'name', label: 'Nome', type: 'text' },
        { key: 'cpf', label: 'CPF', type: 'text' },
        { key: 'role', label: 'Cargo', type: 'text' },
        { key: 'salary', label: 'Salário', type: 'money' },
        { key: 'benefits', label: 'Benefícios/mês', type: 'money' },
        { key: 'hire_date', label: 'Admissão', type: 'date' },
        { key: 'vacation_periods_taken', label: 'Férias já gozadas (períodos)', type: 'num' },
        { key: 'fgts_balance', label: 'Saldo FGTS (extrato)', type: 'money' },
        { key: 'vacation_month', label: 'Mês das férias', type: 'select', options: monthOptions(MONTHS) },
        { key: 'active', label: 'Ativo', type: 'bool' },
        { key: 'termination_date', label: 'Desligamento', type: 'date' },
      ]} actions={(row: Employee) => <button type="button" onClick={() => setSeveranceFor(row)}>Rescisão</button>} />
      {severanceFor && <SeverancePanel employee={severanceFor} onApplied={() => { setSeveranceFor(null); setRefresh((n) => n + 1); }} />}
    </>
  );
}

const expenseFields: FieldSpec[] = [
  { key: 'description', label: 'Descrição', type: 'text' },
  { key: 'category', label: 'Categoria', type: 'select', options: CATEGORY_OPTIONS },
  { key: 'monthly_amount', label: 'Valor mensal cheio', type: 'money' },
  { key: 'follows_calendar', label: 'Segue calendário', type: 'bool' },
  { key: 'due_day', label: 'Dia do vencimento', type: 'num' },
];

export function ExpensesScreen() {
  const school = useTargetSchool();
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <Note>Despesas mensais de <B>{school.name}</B>: água, luz, internet, segurança, alimentação, aluguel etc. Informe a média mensal; as contas reais do mês entram em Lançamentos e aparecem no comparativo previsto x realizado. &quot;Segue calendário&quot; serve para gastos que só existem com as crianças na escola, como alimentação.</Note>
      <EditableTable resource="expenses" query={`school_id=${school.id}`} extra={{ school_id: school.id }} defaults={{ category: 'Alimentação', due_day: 10 }} totalKey="monthly_amount" fields={expenseFields} refreshKey={refresh} />
      <SplitForm resource="expenses" fields={expenseFields} defaults={{ category: 'Segurança', follows_calendar: 0 }} onDone={() => setRefresh((n) => n + 1)} />
    </>
  );
}

export function SuppliersScreen() {
  return (
    <>
      <Note>Fornecedores usados nas contas a pagar (compartilhado entre as escolas).</Note>
      <EditableTable resource="suppliers" fields={[
        { key: 'name', label: 'Nome', type: 'text' },
        { key: 'tax_id', label: 'CNPJ/CPF', type: 'text' },
        { key: 'contact', label: 'Contato', type: 'text' },
      ]} />
    </>
  );
}

export function ChildrenScreen() {
  const school = useTargetSchool();
  const occ = useFetch<{ active: number; capacity: number | null; pct: number | null }>(`children/occupancy?school_id=${school.id}`);
  return (
    <>
      <Note>Crianças matriculadas em <B>{school.name}</B>. Vaga &quot;Prefeitura&quot; entra na receita derivada (crianças × dias letivos × valor por criança-dia, em Parâmetros). Vaga &quot;Particular&quot; gera mensalidade na aba <B>Mensalidades</B>, a partir do valor cadastrado aqui. Sem data de saída, a criança conta como matriculada até hoje. <B>Importante:</B> assim que a 1ª criança de vaga Prefeitura for cadastrada, a receita manual &quot;Contrato Prefeitura&quot; para de contar — cadastre todas as crianças dessa vaga antes de confiar no Painel, ou a receita vai parecer menor do que é.</Note>
      {occ.data && (
        <div className="kpis">
          <Kpi title="Ocupação" value={occ.data.capacity ? `${occ.data.active} / ${occ.data.capacity}` : occ.data.active}
            sub={occ.data.pct != null ? `${pct(occ.data.pct)} das vagas · capacidade em Parâmetros` : 'cadastre a capacidade em Parâmetros para ver o percentual'} />
        </div>
      )}
      {!school.child_daily_rate && <Warning style={{ marginTop: 14 }}>Cadastre o <B>valor por criança-dia da Prefeitura</B> em Parâmetros para as crianças de vaga &quot;Prefeitura&quot; gerarem receita automaticamente.</Warning>}
      <EditableTable resource="children" query={`school_id=${school.id}`} extra={{ school_id: school.id }} defaults={{ enrollment_type: 'public', tuition_amount: 0 }} fields={[
        { key: 'name', label: 'Nome', type: 'text' },
        { key: 'classroom', label: 'Turma', type: 'text' },
        { key: 'enrollment_type', label: 'Vaga', type: 'select', options: [['public', 'Prefeitura'], ['private', 'Particular']] },
        { key: 'tuition_amount', label: 'Mensalidade (particular)', type: 'money' },
        { key: 'birth_date', label: 'Nascimento', type: 'date' },
        { key: 'guardian_name', label: 'Responsável', type: 'text' },
        { key: 'guardian_phone', label: 'Telefone', type: 'text' },
        { key: 'enrollment_date', label: 'Matrícula', type: 'date' },
        { key: 'exit_date', label: 'Saída', type: 'date' },
      ]} />
    </>
  );
}

export function EntriesScreen() {
  const school = useTargetSchool();
  const year = useApp((s) => s.year);
  const [refresh, setRefresh] = useState(0);
  const fields: FieldSpec[] = [
    { key: 'date', label: 'Data', type: 'date' },
    { key: 'type', label: 'Tipo', type: 'select', options: [['revenue', 'Receita'], ['expense', 'Despesa']] },
    { key: 'category', label: 'Categoria', type: 'select', options: CATEGORY_OPTIONS },
    { key: 'description', label: 'Descrição', type: 'text' },
    { key: 'amount', label: 'Valor', type: 'money' },
    { key: 'one_off', label: 'Fora do orçamento', type: 'bool' },
  ];
  return (
    <>
      <Note>Lance o que realmente entrou e saiu em <B>{school.name}</B>: contas de água, luz, internet, segurança, compras. Elas alimentam o comparativo previsto x realizado no Painel. Marque <B>fora do orçamento</B> para gastos que não estavam previstos (compra pontual, rescisão): eles somam ao previsto do mês. Para fechar o mês com o realizado, use Calendário de repasse.</Note>
      <EditableTable resource="entries" query={`school_id=${school.id}&year=${year}`} extra={{ school_id: school.id }} defaults={{ date: today(), type: 'expense', category: 'Luz', one_off: 0 }} fields={fields} refreshKey={refresh} />
      <SplitForm resource="entries" fields={fields.filter((f) => f.key !== 'type')} defaults={{ date: today(), type: 'expense', category: 'Material de limpeza', one_off: 1 }} onDone={() => setRefresh((n) => n + 1)} />
      <div className="add"><ExportButton label={`Exportar lançamentos de ${year} (CSV)`} path={`export/entries?school_id=${school.id}&year=${year}`} /></div>
    </>
  );
}

export type { Child, Revenue };
