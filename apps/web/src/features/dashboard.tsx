'use client';
import { useEffect, useState } from 'react';
import type { Alert, BillsPanel, ConsolidatedReport, MonthResult, Occupancy, TuitionPanel } from '@controle-escolas/contracts';
import { api } from '@/lib/api';
import { brl, brl0, dateBr, MONTHS, pct, tone } from '@/lib/format';
import { TUITION_STATUS } from '@/lib/messages';
import { useApp } from '@/lib/store';
import { useFetch } from '@/lib/useFetch';
import { BalanceChart, CashBarChart } from '@/components/charts';
import { Card, ErrorNote, Kpi, Loading, TableWrap } from '@/components/ui';
import { useDialogs } from '@/components/dialogs';

type SchoolAlert = Alert & { school: string };

function useAlerts(): SchoolAlert[] | null {
  const { school, schools, year } = useApp();
  const [alerts, setAlerts] = useState<SchoolAlert[] | null>(null);
  useEffect(() => {
    const targets = school === 'all' ? schools : schools.filter((s) => s.id === school);
    let live = true;
    void Promise.all(targets.map((s) => api.get<Alert[]>(`alerts?year=${year}&school_id=${s.id}`).then((list) => list.map((a) => ({ ...a, school: s.name })))))
      .then((lists) => { if (live) setAlerts(lists.flat()); });
    return () => { live = false; };
  }, [school, schools, year]);
  return alerts;
}

type Line = { name: string; get: (m: MonthResult) => number; strong?: boolean; noTotal?: boolean; reducedCell?: boolean } | { group: string };

const monthLines = (report: ConsolidatedReport): Line[] => [
  { group: 'Competência (lucro)' },
  { name: 'Receita', get: (m) => m.revenue, reducedCell: true },
  ...(report.totals.derivedRevenue ? [{ name: '  da qual, crianças × dias letivos', get: (m: MonthResult) => m.derivedRevenue }] : []),
  { name: '(−) Salários e benefícios', get: (m) => m.salaries + m.benefits },
  { name: '(−) Encargos', get: (m) => m.charges },
  { name: '(−) Provisão de 13º', get: (m) => m.thirteenthProvision },
  { name: '(−) Provisão de férias', get: (m) => m.vacationProvision },
  { name: '(−) Despesas (alimentação etc.)', get: (m) => m.expenses },
  { name: '(−) Impostos', get: (m) => m.taxes },
  { name: 'Lucro do mês', get: (m) => m.result, strong: true },
  { group: 'Caixa' },
  { name: 'Entradas', get: (m) => m.cashIn },
  { name: 'Saídas', get: (m) => m.cashOut },
  { name: '  das quais 13º e férias', get: (m) => m.thirteenthPayout + m.vacationPayout },
  { name: 'Saldo no fim do mês', get: (m) => m.balance, strong: true, noTotal: true },
];

export function DashboardScreen() {
  const { school, year } = useApp();
  const { notify } = useDialogs();
  const report = useFetch<ConsolidatedReport>(`report?year=${year}&school=${school}`);
  const alerts = useAlerts();
  const occupancy = useFetch<Occupancy>(school === 'all' ? null : `children/occupancy?school_id=${school}`);
  const due = useFetch<BillsPanel>(`bills/panel?school=${school}&days=7`);
  const delinquency = useFetch<TuitionPanel>(`tuition/panel?school=${school}`);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  if (report.error) return <ErrorNote message={report.error} />;
  const r = report.data;
  if (!r || alerts === null) return <Loading />;
  const T = r.totals;
  const negative = r.reserveNeeded > 0;
  const reduced = r.months.filter((m) => m.factor < 1).map((m) => MONTHS[m.month - 1]);
  const lines = monthLines(r);
  const categories = [...(r.categories ?? [])].sort((a, b) => Math.max(b.budgeted, b.actual) - Math.max(a.budgeted, a.actual));

  return (
    <>
      <div className="top">
        <div className="card hero">
          <div className="label">Lucro do ano {year} (competência, já descontadas as provisões)</div>
          <div className={`v ${tone(T.result)}`}>{brl0(T.result)}</div>
          <div className="sub">Margem de {pct(r.margin)} · receita {brl0(T.revenue)} − custos {brl0(T.accrualCost)}</div>
        </div>
        <div className={`card status ${negative ? 'bad' : 'good'}`}>
          <div className="ic" aria-hidden="true">{negative ? '!' : '✓'}</div>
          <div>
            <b>{negative ? 'Caixa fica negativo' : 'Caixa positivo o ano todo'}</b>
            <p>{negative
              ? <>Pior momento em <b>{MONTHS[r.minBalanceMonth - 1]}</b> ({brl0(r.minBalance)}). É preciso ter <b>{brl0(r.reserveNeeded)}</b> guardados a mais até lá para pagar salários nos meses sem repasse.</>
              : `Menor saldo: ${brl0(r.minBalance)} em ${MONTHS[r.minBalanceMonth - 1]}.`}</p>
            {reduced.length > 0 && <p className="sub">Meses com repasse reduzido: {reduced.join(', ')}.</p>}
          </div>
        </div>
      </div>

      <div className="kpis">
        <Kpi title="Receita do ano" value={brl0(T.revenue)} sub="prevista, ou realizada nos meses com lançamento" />
        <Kpi title="Custos do ano" value={brl0(T.accrualCost)} sub="folha, encargos, 13º, férias, impostos e despesas" />
        <Kpi title="Provisão de 13º + férias" value={brl0(T.thirteenthProvision + T.vacationProvision)} sub="reserve todo mês, sai do caixa em nov/dez e nas férias" />
        <Kpi title="Saldo de caixa em dezembro" value={brl0(r.finalBalance)} sub={`partindo de ${brl0(r.initialBalance)}`} tone={tone(r.finalBalance)} />
        {T.derivedRevenue > 0 && <Kpi title="Receita da Prefeitura (crianças)" value={brl0(T.derivedRevenue)} sub="crianças × dias letivos × valor por criança-dia" />}
        {occupancy.data && (occupancy.data.active > 0 || occupancy.data.capacity) && (
          <Kpi title="Ocupação" value={occupancy.data.capacity ? `${occupancy.data.active} / ${occupancy.data.capacity}` : occupancy.data.active}
            sub={occupancy.data.pct != null ? `${pct(occupancy.data.pct)} das vagas` : 'crianças matriculadas'} />
        )}
      </div>

      <Card title="Alertas" sub={alerts.length ? `${alerts.length} coisa(s) para olhar` : 'Nenhum alerta agora.'}>
        {(showAllAlerts ? alerts : alerts.slice(0, 4)).map((a, i) => (
          <div key={i} className="warning" style={{ marginTop: 10, ...(a.level === 'critical' ? { borderLeft: '3px solid var(--neg)' } : {}) }}>
            <b>{a.title}</b>{school === 'all' ? ` · ${a.school}` : ''}<p style={{ margin: '4px 0 0' }}>{a.detail}</p>
          </div>
        ))}
        {alerts.length > 4 && <button type="button" className="sec" style={{ marginTop: 12, color: 'var(--ink)' }} onClick={() => setShowAllAlerts(!showAllAlerts)}>{showAllAlerts ? 'Mostrar menos' : `Ver todos (${alerts.length})`}</button>}
      </Card>

      {due.data && (due.data.overdue.length > 0 || due.data.upcoming.length > 0) && (
        <Card title="Contas a pagar" sub="Vencidas e o que vence nos próximos 7 dias">
          <TableWrap>
            <thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead>
            <tbody>
              {due.data.overdue.length > 0 && <tr className="group"><td colSpan={4}>Vencidas ({brl(due.data.totalOverdue)})</td></tr>}
              {due.data.overdue.map((c) => <tr key={c.id}><td>{dateBr(c.due_date)}</td><td>{c.description}{school === 'all' ? ` · ${c.school}` : ''}</td><td>{c.category}</td><td>{brl(c.amount)}</td></tr>)}
              {due.data.upcoming.length > 0 && <tr className="group"><td colSpan={4}>Próximos 7 dias ({brl(due.data.totalUpcoming)})</td></tr>}
              {due.data.upcoming.map((c) => <tr key={c.id}><td>{dateBr(c.due_date)}</td><td>{c.description}{school === 'all' ? ` · ${c.school}` : ''}</td><td>{c.category}</td><td>{brl(c.amount)}</td></tr>)}
            </tbody>
          </TableWrap>
        </Card>
      )}

      {delinquency.data && delinquency.data.debtors.length > 0 && (
        <Card title="Mensalidades em atraso" sub={`${brl(delinquency.data.totalOverdue)} em atraso de ${brl(delinquency.data.totalDue)} vencidos${delinquency.data.delinquencyPct != null ? ` · inadimplência de ${pct(delinquency.data.delinquencyPct)}` : ''}`}>
          <TableWrap>
            <thead><tr><th>Criança</th>{school === 'all' && <th>Escola</th>}<th>Competência</th><th>Vencimento</th><th>Atraso</th><th>Valor</th><th>Cobrança</th></tr></thead>
            <tbody>
              {delinquency.data.debtors.map((d) => (
                <tr key={d.id}>
                  <td>{d.child}</td>{school === 'all' && <td>{d.school}</td>}<td>{d.period}</td><td>{dateBr(d.due_date)}</td>
                  <td>{(TUITION_STATUS[d.bracket] ?? ['—'])[0]}</td><td>{brl(d.amount)}</td>
                  <td><button type="button" className="sec" onClick={() => navigator.clipboard?.writeText(d.message).then(() => notify('Mensagem copiada.')).catch(() => notify(d.message))}>Copiar mensagem</button></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      )}

      <Card title="Entradas e saídas por mês" sub="Caixa: o que entra e o que sai de fato em cada mês" legend={[['Entradas', 's1'], ['Saídas', 's2']]}>
        <CashBarChart months={r.months} year={year} />
      </Card>
      <Card title="Saldo de caixa acumulado" sub="Quanto dinheiro sobra (ou falta) no fim de cada mês" legend={[['Saldo', 's3']]}>
        <BalanceChart months={r.months} year={year} />
      </Card>

      <Card title="Mês a mês" sub="Meses em amarelo têm repasse reduzido da Prefeitura. Meses fechados usam só o realizado no caixa.">
        <TableWrap>
          <thead>
            <tr><th />
              {r.months.map((m) => <th key={m.month} className={m.factor < 1 ? 'reduced' : ''}>{MONTHS[m.month - 1]}{m.factor < 1 && <span className="tag">repasse {pct(m.factor)}</span>}</th>)}
              <th>Ano</th></tr>
          </thead>
          <tbody>
            {lines.map((line, i) => 'group' in line
              ? <tr key={i} className="group"><td colSpan={14}>{line.group}</td></tr>
              : (
                <tr key={i} className={line.strong ? 'strong' : ''}>
                  <td>{line.name}</td>
                  {r.months.map((m) => <td key={m.month} className={`${line.strong ? tone(line.get(m)) : ''}${m.factor < 1 && line.reducedCell ? ' reduced' : ''}`}>{brl(line.get(m))}</td>)}
                  <td>{line.noTotal ? '' : brl(r.months.reduce((s, m) => s + line.get(m), 0))}</td>
                </tr>
              ))}
          </tbody>
        </TableWrap>
      </Card>

      {categories.length > 0 && (
        <Card title="Despesas por categoria" sub="Previsto no orçamento x realizado nos lançamentos do ano (folha não entra aqui)">
          <TableWrap>
            <thead><tr><th>Categoria</th><th>Previsto</th><th>Realizado</th><th>Diferença</th></tr></thead>
            <tbody>
              {categories.map((c) => {
                const d = c.actual - c.budgeted;
                return (
                  <tr key={c.category}>
                    <td>{c.category}</td><td>{brl0(c.budgeted)}</td><td>{c.actual ? brl0(c.actual) : '—'}</td>
                    <td className={c.actual ? (d > 0 ? 'neg' : 'pos') : ''}>{c.actual ? `${d > 0 ? '▲ ' : '▼ '}${brl0(Math.abs(d))}` : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </Card>
      )}

      {r.bySchool && (
        <Card title="Por escola" sub="Resultado do ano por competência">
          <TableWrap>
            <thead><tr><th>Escola</th><th>Receita</th><th>Custos</th><th>Lucro</th></tr></thead>
            <tbody>{r.bySchool.map((e) => <tr key={e.id}><td>{e.name}</td><td>{brl(e.revenue)}</td><td>{brl(e.accrualCost)}</td><td className={tone(e.result)}>{brl(e.result)}</td></tr>)}</tbody>
          </TableWrap>
        </Card>
      )}
    </>
  );
}
