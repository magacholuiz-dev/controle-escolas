'use client';
import type { CalendarMonth, MetricsComparison, Metrics, Statement, ConsolidatedReport } from '@controle-escolas/contracts';
import { api } from '@/lib/api';
import { brl0, MONTHS, pct, tone, brl } from '@/lib/format';
import { useApp, useTargetSchool } from '@/lib/store';
import { useFetch } from '@/lib/useFetch';
import { Card, ErrorNote, Kpi, Loading, Note, TableWrap, Warning } from '@/components/ui';
import { ExportButton } from '@/components/export-button';
import { FieldInput, type FieldSpec } from '@/components/fields';
import { useDialogs } from '@/components/dialogs';

const B = ({ children }: { children: React.ReactNode }) => <b>{children}</b>;

export function CalendarScreen() {
  const school = useTargetSchool();
  const year = useApp((s) => s.year);
  const { run } = useDialogs();
  const cal = useFetch<CalendarMonth[]>(`calendar?school_id=${school.id}&year=${year}`);
  if (cal.error) return <ErrorNote message={cal.error} />;
  if (!cal.data) return <Loading />;
  const put = (month: number, body: Record<string, unknown>) => run(() => api.put(`calendar?school_id=${school.id}&year=${year}`, { month, ...body }));
  const factor: FieldSpec = { key: 'factor', label: 'Fator de repasse', type: 'num' };
  const days: FieldSpec = { key: 'school_days', label: 'Dias letivos', type: 'num' };
  const closed: FieldSpec = { key: 'closed', label: 'Mês fechado', type: 'bool' };

  return (
    <>
      <Note>Calendário de <B>{school.name}</B>, {year}. <B>Fator de repasse</B> da Prefeitura: 1 = mês inteiro, 0,5 = metade, 0 = nada — usado nas despesas que seguem o calendário. <B>Dias letivos</B>: usado só para calcular a receita da Prefeitura a partir das crianças cadastradas (aba Crianças); não afeta o fator nem as despesas. <B>Mês fechado</B>: o caixa passa a usar só os lançamentos reais do mês. Feche o mês quando todas as contas já estiverem lançadas.</Note>
      <div className="card edit">
        <table>
          <thead><tr><th />{MONTHS.map((m) => <th key={m}>{m}</th>)}</tr></thead>
          <tbody>
            <tr><td>Fator de repasse</td>{cal.data.map((c) => <td key={c.month}><FieldInput spec={factor} value={c.factor} onCommit={(v) => put(c.month, { factor: v })} /></td>)}</tr>
            <tr><td>Dias letivos</td>{cal.data.map((c) => <td key={c.month}><FieldInput spec={days} value={c.school_days} onCommit={(v) => put(c.month, { school_days: v })} /></td>)}</tr>
            <tr><td>Mês fechado</td>{cal.data.map((c) => <td key={c.month}><FieldInput spec={closed} value={c.closed ? 1 : 0} onCommit={(v) => put(c.month, { closed: v === 1 })} /></td>)}</tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

export function StatementScreen() {
  const { school, year } = useApp();
  const target = useTargetSchool();
  const s = useFetch<Statement>(`statement?year=${year}&school=${school}`);
  if (s.error) return <ErrorNote message={s.error} />;
  if (!s.data) return <Loading />;
  return (
    <>
      <Note>DRE de <B>{school === 'all' ? 'todas as escolas' : target.name}</B>, {year}. Cada categoria de despesa cai num grupo (mapa fixo por enquanto); o resultado abaixo é sempre igual ao lucro do Painel — só muda em qual linha cada custo aparece.</Note>
      {s.data.unclassified.length > 0 && <Warning style={{ marginBottom: 14 }}>Categoria(s) sem grupo, em &quot;Não classificado&quot;: <B>{s.data.unclassified.join(', ')}</B>.</Warning>}
      <Card title="DRE do ano" sub="Receita, deduções e custos por grupo (competência)">
        <TableWrap>
          <thead><tr><th>Grupo</th><th>Valor</th></tr></thead>
          <tbody>
            {s.data.groups.map((g) => <tr key={g.group}><td>{g.group}</td><td className={tone(g.amount)}>{brl(g.amount)}</td></tr>)}
            <tr className="strong"><td>Resultado</td><td className={tone(s.data.result)}>{brl(s.data.result)}</td></tr>
          </tbody>
        </TableWrap>
      </Card>
      <div className="add">
        <ExportButton label={`Exportar DRE de ${target.name} (CSV)`} path={`export/statement?school_id=${target.id}&year=${year}`} />
        {school === 'all' && <span className="note">A exportação é sempre de uma escola por vez.</span>}
      </div>
    </>
  );
}

const fmt = {
  money: (v: number | null) => (v != null ? brl0(v) : '—'),
  pct: (v: number | null) => (v != null ? pct(v) : '—'),
  children: (v: number | null) => (v != null ? `${v} crianças` : '—'),
  n: (v: number | null) => (v ?? '—'),
};

export function MetricsScreen() {
  const { school, year } = useApp();
  const target = useTargetSchool();
  const single = school !== 'all';
  const one = useFetch<Metrics>(single ? `metrics?year=${year}&school=${school}` : null);
  const all = useFetch<MetricsComparison>(single ? null : `metrics?year=${year}&school=all`);
  const monthly = useFetch<ConsolidatedReport>(single ? null : `report?year=${year}&school=all`);

  const intro = (
    <Note>Indicadores de saúde do negócio{single ? <> de <B>{target.name}</B></> : ', comparando Novo Mundo e CIC'}. Crianças ativas conta as de hoje (pública + particular). Ponto de equilíbrio: quantas crianças seriam precisas, no total, para cobrir os custos fixos. Custo variável considera Alimentação e Material.</Note>
  );
  if (single) {
    const m = one.data;
    return (
      <>
        {intro}
        {one.error && <ErrorNote message={one.error} />}
        {m && (
          <div className="kpis">
            <Kpi title="Crianças ativas" value={fmt.n(m.activeChildren)} />
            <Kpi title="Custo por criança" value={fmt.money(m.costPerChild)} sub="custos do ano ÷ crianças ativas" />
            <Kpi title="Receita por criança" value={fmt.money(m.revenuePerChild)} />
            <Kpi title="Folha sobre receita" value={fmt.pct(m.payrollOverRevenue)} sub="salários + benefícios + encargos + 13º + férias" />
            <Kpi title="Ponto de equilíbrio" value={fmt.children(m.breakEven)} sub="crianças necessárias para cobrir os custos fixos" />
          </div>
        )}
      </>
    );
  }
  if (all.error) return <ErrorNote message={all.error} />;
  if (!all.data) return <Loading />;
  const rows: [string, keyof Metrics, (v: number | null) => string | number, string | null][] = [
    ['Crianças ativas', 'activeChildren', fmt.n, null],
    ['Custo por criança', 'costPerChild', fmt.money, 'costPerChild'],
    ['Receita por criança', 'revenuePerChild', fmt.money, 'revenuePerChild'],
    ['Folha sobre receita', 'payrollOverRevenue', fmt.pct, 'payrollOverRevenue'],
    ['Ponto de equilíbrio', 'breakEven', fmt.children, 'breakEven'],
    ['Margem', 'margin', fmt.pct, 'margin'],
  ];
  return (
    <>
      {intro}
      <Card title="Comparativo entre escolas" sub="★ marca a melhor escola em cada linha (menor custo por criança e menor ponto de equilíbrio contam como melhor)">
        <TableWrap>
          <thead><tr><th>Indicador</th>{all.data.schools.map((s) => <th key={s.id}>{s.name}</th>)}<th>Consolidado</th></tr></thead>
          <tbody>
            {rows.map(([label, key, format, winnerKey]) => (
              <tr key={label}>
                <td>{label}</td>
                {all.data!.schools.map((s) => {
                  const wins = winnerKey && all.data!.winners[winnerKey] === s.id;
                  return <td key={s.id} className={wins ? 'pos' : ''}>{format(s[key] as number | null)}{wins ? ' ★' : ''}</td>;
                })}
                <td>{format(all.data!.consolidated[key] as number | null)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
      {monthly.data && (
        <Card title="Margem mensal (consolidada)" sub="Lucro do mês ÷ receita do mês">
          <TableWrap>
            <thead><tr><th />{monthly.data.months.map((m) => <th key={m.month}>{MONTHS[m.month - 1]}</th>)}</tr></thead>
            <tbody><tr><td>Margem</td>{monthly.data.months.map((m) => <td key={m.month} className={tone(m.result)}>{m.revenue ? pct(m.result / m.revenue) : '—'}</td>)}</tr></tbody>
          </TableWrap>
        </Card>
      )}
    </>
  );
}
