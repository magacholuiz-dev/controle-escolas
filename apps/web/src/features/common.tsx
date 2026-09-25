'use client';
import { type ReactNode, useState } from 'react';
import { api } from '@/lib/api';
import { brl, isoToMonthBr, maskMonthBr, monthBrToIso, pct, thisPeriod } from '@/lib/format';
import { useApp } from '@/lib/store';
import { Card, Note } from '@/components/ui';
import { FieldInput, type FieldSpec, type FieldValue } from '@/components/fields';
import { useDialogs } from '@/components/dialogs';

export const monthOptions = (months: readonly string[]): [string | number, string][] => [['', 'padrão da escola'], ...months.map((m, i): [number, string] => [i + 1, m])];

// Screen intro text: the school name in bold, like the legacy notes.
export const SchoolNote = ({ name, children }: { name: string; children: (school: ReactNode) => ReactNode }) => <Note>{children(<b>{name}</b>)}</Note>;

// "Gerar … do mês": pick a period, call the generate endpoint, tell what was created.
export function GenerateRow({ label, path, schoolId, emptyMessage, created, onDone }: {
  label: string; path: string; schoolId: string; emptyMessage: string; created: (n: number, period: string) => string; onDone: () => void;
}) {
  const { notify, run } = useDialogs();
  const [period, setPeriod] = useState(thisPeriod());
  const [periodText, setPeriodText] = useState(isoToMonthBr(thisPeriod()));
  return (
    <div className="add">
      <label>Competência <input inputMode="numeric" placeholder="mm/aaaa" maxLength={7} value={periodText} onChange={(e) => { const t = maskMonthBr(e.target.value); setPeriodText(t); const iso = monthBrToIso(t); if (iso) setPeriod(iso); }} aria-label="Competência" aria-invalid={!monthBrToIso(periodText) || undefined} /></label>
      <button type="button" disabled={!monthBrToIso(periodText)} onClick={() => run(async () => {
        const r = await api.post<{ created: number }>(path, { school_id: schoolId, period });
        notify(r.created ? created(r.created, isoToMonthBr(period)) : emptyMessage);
        onDone();
      })}>{label}</button>
    </div>
  );
}

// Splits one purchase between the two schools (evenly, by enrollment, or by a manual percentage).
export function SplitForm({ resource, fields, defaults, onDone }: { resource: 'expenses' | 'entries' | 'bills'; fields: FieldSpec[]; defaults: Record<string, FieldValue>; onDone: () => void }) {
  const schools = useApp((s) => s.schools);
  const { run } = useDialogs();
  const [school1, school2] = schools;
  const [data, setData] = useState<Record<string, FieldValue>>(() => ({
    ...Object.fromEntries(fields.map((f) => [f.key, f.type === 'select' ? (f.options?.[0]?.[0] ?? '') : f.type === 'bool' ? 0 : f.type === 'money' || f.type === 'num' ? null : ''])),
    ...defaults,
  }));
  const [mode, setMode] = useState<'equal' | 'children' | 'manual'>('equal');
  const [pct1, setPct1] = useState(50);
  if (!school1 || !school2) return null;

  const amountKey = resource === 'expenses' ? 'monthly_amount' : 'amount';
  const total = Number(data[amountKey]) || 0;
  const p1 = mode === 'equal' ? 50 : mode === 'manual' ? pct1 : (school1.children_count / ((school1.children_count + school2.children_count) || 1)) * 100;
  const preview = total ? `${school1.name}: ${brl(total * p1 / 100)} (${pct(p1 / 100)}) · ${school2.name}: ${brl(total * (100 - p1) / 100)} (${pct((100 - p1) / 100)})` : '';

  return (
    <Card title="Dividir entre as escolas" sub="Um único valor (ex.: compra de panelas e produtos de limpeza) vira um lançamento em cada escola, cada um com a sua parte.">
      <div className="add">
        {fields.map((f) => (
          <label key={f.key}>{f.label}<FieldInput spec={f} value={data[f.key]} onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))} /></label>
        ))}
        <label>Como dividir
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label="Como dividir">
            <option value="equal">Igual (50/50)</option>
            <option value="children">Proporcional às crianças</option>
            <option value="manual">Percentual manual</option>
          </select>
        </label>
        {mode === 'manual' && (
          <label>% para {school1.name}<input type="number" value={pct1} onChange={(e) => setPct1(Number(e.target.value))} aria-label={`% para ${school1.name}`} /></label>
        )}
        <button type="button" onClick={() => run(async () => {
          await api.post('split', { resource, data, mode, percentages: { [school1.id]: pct1, [school2.id]: 100 - pct1 } });
          onDone();
        })}>Dividir e lançar</button>
      </div>
      <div className="note" style={{ width: '100%', marginTop: 10 }}>{preview}</div>
    </Card>
  );
}
