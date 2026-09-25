'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthResult } from '@controle-escolas/contracts';
import { brl, compact, MONTHS } from '@/lib/format';

interface AxisTickProps { x?: number | string; y?: number | string; payload?: { value: number | string } }

// Month label; months with a reduced city-hall transfer get the warning color and a second line.
const monthTick = (months: MonthResult[]) => function MonthTick({ x = 0, y = 0, payload }: AxisTickProps) {
  const i = Number(payload?.value ?? 0);
  const m = months[i];
  const reduced = !!m && m.factor < 1;
  return (
    <g transform={`translate(${x},${y})`}>
      <text y={14} textAnchor="middle" style={reduced ? { fill: 'var(--warn-ink)', fontWeight: 600 } : undefined}>{MONTHS[i]}</text>
      {reduced && m && <text y={27} textAnchor="middle" style={{ fill: 'var(--warn-ink)', fontSize: 10 }}>repasse {Math.round(m.factor * 100)}%</text>}
    </g>
  );
};

interface TipProps { active?: boolean; payload?: { payload: Datum }[]; label?: number; months: MonthResult[]; year: number; lines: (m: MonthResult) => [string, string, number][] }
type Datum = MonthResult & { i: number };

function Tip({ active, payload, months, year, lines }: TipProps) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  const m = months[d.i] as MonthResult;
  return (
    <div className="tip" style={{ position: 'static' }}>
      <div className="month">{MONTHS[d.i]} {year}{m.factor < 1 ? ` · repasse ${Math.round(m.factor * 100)}%` : ''}</div>
      {lines(m).map(([name, color, v]) => (
        <div className="row" key={name}>
          <span><i style={{ background: `var(--${color})` }} />{name}</span><b>{brl(v)}</b>
        </div>
      ))}
    </div>
  );
}

const data = (months: MonthResult[]): Datum[] => months.map((m, i) => ({ ...m, i }));

// Round axis values (1, 2, 2.5, 5 × 10^n) covering [lo, hi], like the legacy charts.
export function niceTicks(lo: number, hi: number, n = 4): number[] {
  const raw = (hi - lo) / n || 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((p) => p >= raw) ?? magnitude;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(v);
  return out;
}
const axis = { stroke: 'var(--axis)' };

export function CashBarChart({ months, year }: { months: MonthResult[]; year: number }) {
  const hi = Math.max(1, ...months.flatMap((m) => [m.cashIn, m.cashOut]));
  const tk = niceTicks(0, hi);
  return (
    <div className="chart" role="img" aria-label="Gráfico mensal de entradas e saídas; os mesmos valores estão na tabela abaixo">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data(months)} margin={{ top: 12, right: 12, bottom: 20, left: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="i" tick={monthTick(months)} tickLine={false} axisLine={axis} interval={0} height={44} />
          <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={70} tick={{ fill: 'var(--muted)', fontSize: 11 }} ticks={tk} domain={[Math.min(0, tk[0] as number), Math.max(hi, tk[tk.length - 1] as number)]} />
          <Tooltip cursor={{ fill: 'var(--wash)' }} content={<Tip months={months} year={year} lines={(m) => [['Entradas', 's1', m.cashIn], ['Saídas', 's2', m.cashOut]]} />} />
          <Bar dataKey="cashIn" name="Entradas" fill="var(--s1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="cashOut" name="Saídas" fill="var(--s2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceChart({ months, year }: { months: MonthResult[]; year: number }) {
  const balances = months.map((m) => m.balance);
  const iMin = balances.indexOf(Math.min(...balances));
  const lo = Math.min(0, ...balances);
  const hi = Math.max(0, ...balances);
  const tk = niceTicks(lo, hi);
  const label = (i: number, prefix = '') => (
    <ReferenceDot key={i} x={i} y={balances[i] as number} r={5} fill="var(--s3)" stroke="var(--surface)" strokeWidth={2}
      label={{ value: prefix + brl(balances[i]), position: (balances[i] as number) < 0 ? 'bottom' : 'top', offset: 10, fill: 'var(--ink)', fontSize: 11, fontWeight: 600, style: { fill: 'var(--ink)' } }} />
  );
  return (
    <div className="chart" role="img" aria-label="Gráfico do saldo de caixa acumulado; os mesmos valores estão na tabela abaixo">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data(months)} margin={{ top: 28, right: 40, bottom: 20, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="i" tick={monthTick(months)} tickLine={false} axisLine={axis} interval={0} height={44} />
          <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={70} tick={{ fill: 'var(--muted)', fontSize: 11 }} ticks={tk} domain={[Math.min(lo, tk[0] as number), Math.max(hi, tk[tk.length - 1] as number)]} />
          <ReferenceLine y={0} stroke="var(--axis)" />
          <Tooltip content={<Tip months={months} year={year} lines={(m) => [['Saldo', 's3', m.balance]]} />} />
          <Area type="linear" dataKey="balance" name="Saldo" stroke="var(--s3)" strokeWidth={2} fill="var(--s3)" fillOpacity={0.1} isAnimationActive={false} />
          {iMin !== 11 && label(iMin, 'Pior: ')}
          {label(11)}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
