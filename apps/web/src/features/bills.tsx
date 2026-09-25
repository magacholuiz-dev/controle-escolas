'use client';
import { useState } from 'react';
import type { Bill, InstallmentResult, Supplier, Tuition } from '@controle-escolas/contracts';
import { api } from '@/lib/api';
import { brl, dateBrToIso, formatMoneyInput, installmentPreview, isoToBr, isoToMonthBr, parseNumberBr, thisPeriod, today } from '@/lib/format';
import { useTargetSchool } from '@/lib/store';
import { useFetch } from '@/lib/useFetch';
import { BILL_STATUS, CATEGORY_OPTIONS, TUITION_STATUS } from '@/lib/messages';
import { EditableTable } from '@/components/editable-table';
import { ExportButton } from '@/components/export-button';
import { FieldInput, type FieldSpec, type FieldValue } from '@/components/fields';
import { Card, Note } from '@/components/ui';
import { useDialogs } from '@/components/dialogs';
import { GenerateRow, SplitForm } from './common';

const B = ({ children }: { children: React.ReactNode }) => <b>{children}</b>;
const Status = ({ table, status }: { table: Record<string, [string, string]>; status: string }) => {
  const [text, cls] = table[status] ?? ['—', ''];
  return <span className={cls}>{text}</span>;
};

// "R$ 2.000 in 3x" (total) or "10x of R$ 340" (value of each installment): one monthly bill each.
function InstallmentForm({ schoolId, suppliers, onDone }: { schoolId: string; suppliers: Supplier[]; onDone: () => void }) {
  const { notify, run } = useDialogs();
  const [data, setData] = useState<Record<string, FieldValue>>({ description: '', category: 'Outros', supplier_id: '', first_due_date: today(), count: 3, mode: 'total', value: null });
  const specs: FieldSpec[] = [
    { key: 'description', label: 'Descrição', type: 'text' },
    { key: 'category', label: 'Categoria', type: 'select', options: CATEGORY_OPTIONS },
    { key: 'supplier_id', label: 'Fornecedor', type: 'select', options: [['', '—'], ...suppliers.map((s): [string, string] => [s.id, s.name])] },
    { key: 'first_due_date', label: '1º vencimento', type: 'date' },
    { key: 'count', label: 'Nº de parcelas', type: 'num' },
    { key: 'mode', label: 'O valor informado é', type: 'select', options: [['total', 'o total da compra'], ['each', 'o valor de cada parcela']] },
    { key: 'value', label: 'Valor', type: 'money' },
  ];
  const preview = installmentPreview(data.mode as 'total' | 'each', Number(data.count), Number(data.value));

  return (
    <Card title="Compra parcelada" sub="Informe o valor total ou o valor de cada parcela: cada parcela vira uma conta a pagar, uma por mês, a partir do 1º vencimento.">
      <div className="add">
        {specs.map((f) => <label key={f.key}>{f.label}<FieldInput spec={f} value={data[f.key]} onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))} /></label>)}
        <button type="button" onClick={() => run(async () => {
          const r = await api.post<InstallmentResult>('bills/installments', {
            school_id: schoolId, description: data.description, category: data.category, supplier_id: data.supplier_id || undefined,
            first_due_date: data.first_due_date, count: Number(data.count),
            [data.mode === 'total' ? 'total_amount' : 'installment_amount']: data.value,
          });
          notify(`${r.count} parcelas lançadas, total de ${brl(r.total)}.`);
          onDone();
        })}>Lançar parcelas</button>
      </div>
      <div className="note" style={{ width: '100%', marginTop: 10 }}>{preview}</div>
    </Card>
  );
}

// A fixed monthly debit (rent, security, internet...): one recurring expense plus a bill for every month in the range.
function RecurringForm({ schoolId, suppliers, onDone }: { schoolId: string; suppliers: Supplier[]; onDone: () => void }) {
  const { notify, run } = useDialogs();
  const year = thisPeriod().slice(0, 4);
  const [data, setData] = useState<Record<string, FieldValue>>({ description: '', category: 'Aluguel', supplier_id: '', amount: null, due_day: 10, from_period: thisPeriod(), to_period: `${year}-12` });
  const specs: FieldSpec[] = [
    { key: 'description', label: 'Descrição', type: 'text' },
    { key: 'category', label: 'Categoria', type: 'select', options: CATEGORY_OPTIONS },
    { key: 'supplier_id', label: 'Fornecedor', type: 'select', options: [['', '—'], ...suppliers.map((s): [string, string] => [s.id, s.name])] },
    { key: 'amount', label: 'Valor mensal', type: 'money' },
    { key: 'due_day', label: 'Dia do vencimento (1 a 28)', type: 'num' },
    { key: 'from_period', label: 'A partir de', type: 'month' },
    { key: 'to_period', label: 'Até', type: 'month' },
  ];
  return (
    <Card title="Débito recorrente" sub="Para o que se repete todo mês com o mesmo valor (aluguel, segurança, internet): informe uma vez e as contas de cada mês são lançadas de uma só vez.">
      <div className="add">
        {specs.map((f) => <label key={f.key}>{f.label}<FieldInput spec={f} value={data[f.key]} onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))} /></label>)}
        <button type="button" onClick={() => run(async () => {
          const r = await api.post<{ created: number }>('bills/recurring', {
            school_id: schoolId, description: data.description, category: data.category, supplier_id: data.supplier_id || undefined,
            amount: data.amount, due_day: data.due_day, from_period: data.from_period, to_period: data.to_period,
          });
          notify(`${r.created} conta(s) lançada(s), uma por mês.`);
          onDone();
        })}>Lançar recorrência</button>
      </div>
    </Card>
  );
}

// Asks (in pt-BR) how much was paid and when; null when cancelled or unreadable.
async function askPayment(prompt: (m: string, initial?: string) => Promise<string | null>, notify: (m: string) => void, suggested: number): Promise<{ amount_paid: number; paid_at: string } | null> {
  const amountText = await prompt('Valor pago (R$):', formatMoneyInput(suggested)); if (amountText === null) return null;
  const amount = parseNumberBr(amountText);
  if (amount === null || amount <= 0) { notify('Valor pago inválido. Exemplo: R$ 1.234,56'); return null; }
  const dateText = await prompt('Data do pagamento (dd/mm/aaaa):', isoToBr(today())); if (dateText === null) return null;
  const date = dateBrToIso(dateText);
  if (!date) { notify('Data inválida. Use dd/mm/aaaa, por exemplo 22/09/2026.'); return null; }
  return { amount_paid: amount, paid_at: date };
}

export function BillsScreen() {
  const school = useTargetSchool();
  const { confirm, notify, prompt, run } = useDialogs();
  const suppliers = useFetch<Supplier[]>('suppliers');
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh((n) => n + 1);
  const period = thisPeriod();
  const fields: FieldSpec[] = [
    { key: 'description', label: 'Descrição', type: 'text' },
    { key: 'category', label: 'Categoria', type: 'select', options: CATEGORY_OPTIONS },
    { key: 'supplier_id', label: 'Fornecedor', type: 'select', options: [['', '—'], ...(suppliers.data ?? []).map((s): [string, string] => [s.id, s.name])] },
    { key: 'period', label: 'Competência', type: 'month' },
    { key: 'due_date', label: 'Vencimento', type: 'date' },
    { key: 'amount', label: 'Valor', type: 'money' },
  ];
  if (!suppliers.data) return null;

  return (
    <>
      <Note>Contas a pagar de <B>{school.name}</B>: água, luz, internet, segurança, fornecedores. &quot;Gerar contas do mês&quot; cria uma conta para cada despesa recorrente (cadastrada em Despesas), no dia de vencimento configurado. Pagar lança o valor real no realizado; o previsto x realizado do Painel usa esse valor.</Note>
      <GenerateRow label="Gerar contas do mês" path="bills/generate" schoolId={school.id} onDone={bump}
        created={(n, p) => `${n} conta(s) criada(s) para ${p}.`} emptyMessage="Nenhuma conta nova: já foram geradas para este mês." />
      <RecurringForm schoolId={school.id} suppliers={suppliers.data} onDone={bump} />
      <InstallmentForm schoolId={school.id} suppliers={suppliers.data} onDone={bump} />
      <EditableTable resource="bills" query={`school_id=${school.id}`} extra={{ school_id: school.id }} refreshKey={refresh} fields={fields}
        defaults={{ category: 'Outros', period, due_date: `${period}-10` }}
        extraColumns={[
          { label: 'Parcela', render: (l: Bill) => (l.installment_count ? `${l.installment_no}/${l.installment_count}` : '—') },
          { label: 'Situação', render: (l: Bill) => <Status table={BILL_STATUS} status={l.status} /> },
          // Once paid, the amount and date actually paid can still be corrected; the ledger entry follows.
          { label: 'Pago em', render: (l: Bill) => l.paid_at ? <FieldInput spec={{ key: 'paid_at', label: 'Pago em', type: 'date' }} value={l.paid_at} onCommit={(v) => run(async () => { await api.put(`bills/${l.id}`, { paid_at: v }); bump(); })} /> : '—' },
          { label: 'Valor pago', render: (l: Bill) => l.paid_at ? <FieldInput spec={{ key: 'amount_paid', label: 'Valor pago', type: 'money' }} value={l.amount_paid} onCommit={(v) => run(async () => { await api.put(`bills/${l.id}`, { amount_paid: v }); bump(); })} /> : '—' },
        ]}
        removeMessage={(row: Bill) => (row.paid_at ? 'Esta conta já foi paga. Excluir também remove o lançamento de despesa correspondente. Continuar?' : undefined)}
        actions={(row: Bill, { reload }) => (
          <>
            {row.expense_id && (
              <button type="button" className="sec" title="Remove as contas em aberto desta recorrência e encerra o débito recorrente" onClick={async () => {
                if (await confirm(`Encerrar a recorrência de "${row.description}"? As contas em aberto serão excluídas; as já pagas ficam.`)) await run(async () => { await api.del(`bills/recurring/${row.expense_id}`); reload(); });
              }}>Encerrar recorrência</button>
            )}
            {row.installment_group_id && row.status !== 'paid' && (
              <button type="button" className="sec" title="Remove todas as parcelas ainda não pagas desta compra" onClick={async () => {
                if (await confirm(`Excluir todas as parcelas em aberto de "${row.description}"? As já pagas ficam.`)) await run(async () => { await api.del(`bills/${row.id}?installments=1`); reload(); });
              }}>Excluir compra</button>
            )}
            {row.status === 'paid' ? (
              <button type="button" className="sec" onClick={async () => {
                if (await confirm('Desfazer o pagamento? O lançamento correspondente será removido.')) await run(async () => { await api.post(`bills/${row.id}/undo`); reload(); });
              }}>Desfazer</button>
            ) : (
              <button type="button" onClick={async () => {
                const paid = await askPayment(prompt, notify, row.amount); if (!paid) return;
                await run(async () => { await api.post(`bills/${row.id}/pay`, paid); reload(); });
              }}>Pagar</button>
            )}
          </>
        )} />
      <SplitForm resource="bills" fields={fields.filter((f) => f.key !== 'supplier_id')} defaults={{ category: 'Segurança', period, due_date: `${period}-10` }} onDone={bump} />
      <div className="add"><ExportButton label={`Exportar contas pagas de ${isoToMonthBr(period)} (CSV)`} path={`export/bills?school_id=${school.id}&period=${period}`} /></div>
    </>
  );
}

export function TuitionScreen() {
  const school = useTargetSchool();
  const { confirm, notify, prompt, run } = useDialogs();
  const children = useFetch<{ id: string; name: string; enrollment_type: string }[]>(`children?school_id=${school.id}`);
  const [refresh, setRefresh] = useState(0);
  const period = thisPeriod();
  if (!children.data) return null;

  return (
    <>
      <Note>Mensalidades das crianças de vaga particular em <B>{school.name}</B>. &quot;Gerar mensalidades do mês&quot; cria uma para cada criança particular ativa, no dia de vencimento da escola (Parâmetros), a partir do valor cadastrado em Crianças. O desconto é aplicado por mensalidade (ex.: bolsa, irmãos).</Note>
      <GenerateRow label="Gerar mensalidades do mês" path="tuition/generate" schoolId={school.id} onDone={() => setRefresh((n) => n + 1)}
        created={(n, p) => `${n} mensalidade(s) criada(s) para ${p}.`}
        emptyMessage="Nenhuma mensalidade nova: já foram geradas para este mês, ou não há crianças de vaga particular com valor cadastrado." />
      <EditableTable resource="tuition" query={`school_id=${school.id}`} extra={{ school_id: school.id }} refreshKey={refresh}
        defaults={{ period, due_date: `${period}-10`, discount: 0 }}
        fields={[
          { key: 'child_id', label: 'Criança', type: 'select', options: [['', '—'], ...children.data.filter((c) => c.enrollment_type === 'private').map((c): [string, string] => [c.id, c.name])] },
          { key: 'period', label: 'Competência', type: 'month' },
          { key: 'due_date', label: 'Vencimento', type: 'date' },
          { key: 'base_amount', label: 'Valor base', type: 'money' },
          { key: 'discount', label: 'Desconto', type: 'money' },
        ]}
        extraColumns={[
          { label: 'Cobrança', render: (l: Tuition) => brl(Math.max(0, (l.base_amount || 0) - (l.discount || 0))) },
          { label: 'Situação', render: (l: Tuition) => <Status table={TUITION_STATUS} status={l.status} /> },
        ]}
        actions={(row: Tuition, { reload }) => (row.status === 'paid' ? (
          <button type="button" className="sec" onClick={async () => {
            if (await confirm('Desfazer o pagamento? O lançamento correspondente será removido.')) await run(async () => { await api.post(`tuition/${row.id}/undo`); reload(); });
          }}>Desfazer</button>
        ) : (
          <button type="button" onClick={async () => {
            const paid = await askPayment(prompt, notify, Math.max(0, (row.base_amount || 0) - (row.discount || 0))); if (!paid) return;
            await run(async () => { await api.post(`tuition/${row.id}/pay`, paid); reload(); });
          }}>Pagar</button>
        ))} />
    </>
  );
}
