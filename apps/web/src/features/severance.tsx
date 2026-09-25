'use client';
import { useState } from 'react';
import type { Employee, SeveranceResult } from '@controle-escolas/contracts';
import { api, qs } from '@/lib/api';
import { brl, dateBr, pct, today, tone } from '@/lib/format';
import { Card, TableWrap } from '@/components/ui';
import { FieldInput, type FieldSpec, type FieldValue } from '@/components/fields';
import { useDialogs } from '@/components/dialogs';

const TYPES: [string, string][] = [['without_cause', 'Demissão sem justa causa'], ['resignation', 'Pedido de demissão'], ['mutual_agreement', 'Acordo (art. 484-A)'], ['for_cause', 'Justa causa']];
const DEFS: FieldSpec[] = [
  { key: 'date', label: 'Data da rescisão', type: 'date' },
  { key: 'type', label: 'Motivo', type: 'select', options: TYPES },
  { key: 'notice', label: 'Aviso prévio', type: 'select', options: [['paid_in_lieu', 'Indenizado'], ['worked', 'Trabalhado']] },
  { key: 'notice_worked', label: 'Aviso cumprido (pedido de demissão)', type: 'bool' },
];

// Simulates an employee's severance (CLT rules, done by the API) and, on confirmation, applies it:
// the employee is terminated and the cost is posted as a one-off "Rescisão" expense.
export function SeverancePanel({ employee, onApplied }: { employee: Employee; onApplied: () => void }) {
  const { confirm, run } = useDialogs();
  const [params, setParams] = useState<Record<string, FieldValue>>({ date: today(), type: 'without_cause', notice: 'paid_in_lieu', notice_worked: 1 });
  const [result, setResult] = useState<SeveranceResult | null>(null);
  const [error, setError] = useState('');

  const query = () => ({ employee_id: employee.id, ...params, notice_worked: params.notice_worked ? '1' : '0' });

  const calculate = async () => {
    setError(''); setResult(null);
    try { setResult(await api.get<SeveranceResult>(`severance?${qs(query() as Record<string, string>)}`)); }
    catch (e) { setError((e as Error).message); }
  };

  const apply = async () => {
    if (!result) return;
    const ok = await confirm(`Desligar ${employee.name} em ${dateBr(String(params.date))} e lançar ${brl(result.schoolCost)} como despesa avulsa (categoria Rescisão)?`);
    if (ok) await run(async () => { await api.post('severance', query()); onApplied(); });
  };

  const sub = employee.hire_date
    ? `Admitido(a) em ${dateBr(employee.hire_date)} · salário ${brl(employee.salary)}`
    : 'Preencha a data de admissão na tabela acima para calcular.';

  return (
    <Card title={`Rescisão de ${employee.name}`} sub={sub}>
      <div className="add">
        {DEFS.map((d) => (
          <label key={d.key}>{d.label}<FieldInput spec={d} value={params[d.key]} onChange={(v) => setParams((p) => ({ ...p, [d.key]: v }))} /></label>
        ))}
        <button type="button" onClick={calculate}>Calcular</button>
      </div>
      {error && <p className="note" role="alert">{error}</p>}
      {result && (
        <>
          <TableWrap>
            <thead><tr><th>Verba</th><th>Detalhe</th><th>Valor</th></tr></thead>
            <tbody>
              {result.lines.map((l) => <tr key={l.name}><td>{l.name}</td><td>{l.note}</td><td className={l.amount < 0 ? 'neg' : ''}>{brl(l.amount)}</td></tr>)}
              <tr className="strong"><td>Total a pagar ao colaborador (bruto)</td><td /><td>{brl(result.totalToEmployee)}</td></tr>
              <tr><td>Depósito de FGTS sobre as verbas</td><td>8%</td><td>{brl(result.fgts.severanceDeposit)}</td></tr>
              <tr><td>Multa do FGTS ({pct(result.fgts.finePct)})</td><td>saldo estimado {brl(result.fgts.estimatedBalance)} · saque {result.fgts.withdrawalAllowed}</td><td>{brl(result.fgts.fine)}</td></tr>
              <tr className="strong"><td>Custo total para a escola</td><td>data considerada: {dateBr(result.projectedDate)}</td><td className={tone(-result.schoolCost)}>{brl(result.schoolCost)}</td></tr>
            </tbody>
          </TableWrap>
          <ul className="note">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          <button type="button" onClick={apply}>Efetivar desligamento</button>
        </>
      )}
    </Card>
  );
}
