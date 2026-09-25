'use client';
import { useState } from 'react';
import type { Adjustment, Employee, Scenario, Simulation } from '@controle-escolas/contracts';
import { api } from '@/lib/api';
import { brl, dateBr, pct, tone } from '@/lib/format';
import { CATEGORY_OPTIONS } from '@/lib/messages';
import { useApp, useTargetSchool } from '@/lib/store';
import { useFetch } from '@/lib/useFetch';
import { Card, Loading, Note, TableWrap, Warning } from '@/components/ui';
import { FieldInput, type FieldSpec, type FieldValue } from '@/components/fields';
import { useDialogs } from '@/components/dialogs';

const LABELS: Record<Adjustment['type'], string> = { delay_transfer: 'Atrasar o repasse', hire: 'Contratar', terminate: 'Demitir', cut_expense: 'Cortar despesa' };

// What-if simulation: never writes anything. "Salvar" only stores the list of adjustments.
export function ScenariosScreen() {
  const school = useTargetSchool();
  const year = useApp((s) => s.year);
  const { confirm, notify, run } = useDialogs();
  const employees = useFetch<Employee[]>(`employees?school_id=${school.id}`);
  const saved = useFetch<Scenario[]>(`scenarios?school_id=${school.id}`);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [type, setType] = useState<Adjustment['type']>('delay_transfer');
  const [draft, setDraft] = useState<Record<string, FieldValue>>({});
  const [result, setResult] = useState<Simulation | null>(null);
  const [name, setName] = useState('');
  if (!employees.data) return <Loading />;
  const people = employees.data;

  const specs: Record<Adjustment['type'], FieldSpec[]> = {
    delay_transfer: [{ key: 'months', label: 'Meses de atraso', type: 'num' }],
    hire: [{ key: 'salary', label: 'Salário', type: 'money' }, { key: 'benefits', label: 'Benefícios', type: 'money' }, { key: 'hire_date', label: 'A partir de', type: 'date' }],
    terminate: [
      { key: 'employee_id', label: 'Colaborador', type: 'select', options: people.map((e): [string, string] => [e.id, e.name]) },
      { key: 'date', label: 'Data', type: 'date' },
      { key: 'severance_type', label: 'Motivo', type: 'select', options: [['without_cause', 'Sem justa causa'], ['mutual_agreement', 'Acordo'], ['resignation', 'Pedido de demissão']] },
    ],
    cut_expense: [{ key: 'category', label: 'Categoria', type: 'select', options: CATEGORY_OPTIONS }, { key: 'pct', label: 'Corte (%)', type: 'num' }],
  };
  const withDefaults = (t: Adjustment['type']): Record<string, FieldValue> => Object.fromEntries(specs[t].map((f) => [f.key, f.type === 'select' ? (f.options?.[0]?.[0] ?? '') : f.type === 'money' || f.type === 'num' ? null : '']));
  const value = (k: string): FieldValue => (k in draft ? (draft[k] as FieldValue) : (withDefaults(type)[k] as FieldValue));

  const describe = (a: Adjustment): string => {
    if (a.type === 'delay_transfer') return `Atrasar o repasse em ${a.months} mês(es)`;
    if (a.type === 'hire') return `Contratar por ${brl(a.salary)}/mês a partir de ${a.hire_date ? dateBr(a.hire_date) : '—'}`;
    if (a.type === 'terminate') return `Demitir ${people.find((e) => e.id === a.employee_id)?.name ?? a.employee_id} em ${a.date}`;
    return `Cortar ${pct(a.pct)} de "${a.category}"`;
  };
  const add = () => {
    const all = { ...withDefaults(type), ...draft };
    const entry = { type, ...all } as Record<string, unknown>;
    if (type === 'cut_expense' && entry.pct != null) entry.pct = Number(entry.pct) / 100; // the field shows 0–100, the API expects 0–1
    setAdjustments((list) => [...list, entry as unknown as Adjustment]);
    setDraft({});
  };
  const simulate = () => run(async () => setResult(await api.post<Simulation>('scenarios/simulate', { school_id: school.id, year, adjustments })));
  const save = () => {
    if (!name) { notify('Dê um nome ao cenário para salvar.', 'error'); return; }
    void run(async () => { await api.post('scenarios', { school_id: school.id, name, adjustments }); setName(''); saved.reload(); });
  };

  const row = (label: string, key: keyof Simulation['base']) => {
    const r = result as Simulation;
    return <tr key={key}><td>{label}</td><td>{brl(r.base[key])}</td><td>{brl(r.scenario[key])}</td><td className={tone(r.scenario[key] - r.base[key])}>{brl(r.scenario[key] - r.base[key])}</td></tr>;
  };

  return (
    <>
      <Note>Simule sem alterar nada de <b>{school.name}</b>: atrasar o repasse, contratar, demitir (com a rescisão calculada de verdade) ou cortar uma categoria de despesa. &quot;Simular&quot; nunca grava; &quot;Salvar&quot; só guarda a lista de ajustes, para reabrir depois.</Note>
      <Card title="Montar cenário" sub="Adicione um ou mais ajustes e simule">
        <div className="add">
          <label>Ajuste
            <select value={type} onChange={(e) => { setType(e.target.value as Adjustment['type']); setDraft({}); }} aria-label="Ajuste">
              {Object.entries(LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {specs[type].map((f) => <label key={`${type}-${f.key}`}>{f.label}<FieldInput spec={f} value={value(f.key)} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} /></label>)}
          <button type="button" onClick={add}>Adicionar ajuste</button>
        </div>
      </Card>
      <div className="note">
        {adjustments.length ? (
          <ul>{adjustments.map((a, i) => <li key={i}>{describe(a)} <button type="button" className="sec" onClick={() => setAdjustments((l) => l.filter((_, j) => j !== i))}>remover</button></li>)}</ul>
        ) : 'Nenhum ajuste ainda.'}
      </div>
      <Card title="Simular" sub="Compara com a base sem alterar nenhum dado real">
        <div className="add">
          <button type="button" onClick={simulate}>Simular</button>
          <input type="text" placeholder="Nome para salvar (opcional)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do cenário" />
          <button type="button" className="sec" onClick={save}>Salvar cenário</button>
        </div>
      </Card>
      {result && (
        <>
          <TableWrap>
            <thead><tr><th /><th>Base</th><th>Cenário</th><th>Diferença</th></tr></thead>
            <tbody>{row('Lucro do ano', 'result')}{row('Pior saldo de caixa', 'minBalance')}{row('Saldo final', 'finalBalance')}{row('Reserva necessária', 'reserveNeeded')}</tbody>
          </TableWrap>
          {result.warnings.length > 0 && <Warning style={{ marginTop: 10 }}>{result.warnings.map((w) => <div key={w}>{w}</div>)}</Warning>}
        </>
      )}
      {saved.data && saved.data.length > 0 && (
        <Card title="Cenários salvos">
          <TableWrap>
            <thead><tr><th>Cenário</th><th /></tr></thead>
            <tbody>
              {saved.data.map((s) => (
                <tr key={s.id}><td>{s.name}</td><td className="actions"><button type="button" className="sec" onClick={async () => {
                  if (await confirm('Excluir este cenário salvo?')) await run(async () => { await api.del(`scenarios/${s.id}`); saved.reload(); });
                }}>Excluir</button></td></tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      )}
    </>
  );
}
