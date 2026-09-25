'use client';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { brl, pct } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';
import { ErrorNote, Loading } from './ui';
import { FieldInput, type FieldSpec, type FieldValue } from './fields';
import { useDialogs } from './dialogs';

type Row = { id: string; group_id?: string | null; total_amount?: number | null; split_pct?: number | null; active?: number } & Record<string, unknown>;

export interface EditableTableProps {
  resource: string;
  /** query string for the list, e.g. `school_id=…&year=2026` */
  query?: string;
  fields: FieldSpec[];
  /** sent with every create (usually `{ school_id }`) */
  extra?: Record<string, unknown>;
  defaults?: Record<string, FieldValue>;
  totalKey?: string;
  extraColumns?: { label: string; render: (row: never) => ReactNode }[];
  actions?: (row: never, ctx: { reload: () => void }) => ReactNode;
  /** overrides the delete confirmation text for a row */
  removeMessage?: (row: never) => string | undefined;
  /** bump to refetch from the outside */
  refreshKey?: number;
}

// Generic editable list: change a cell and it saves, "Excluir" asks first, the row at the bottom adds.
// Replaces the legacy `crud()` helper.
export function EditableTable({ resource, query = '', fields, extra = {}, defaults = {}, totalKey, extraColumns = [], actions, removeMessage, refreshKey = 0 }: EditableTableProps) {
  const list = useFetch<Row[]>(`${resource}?${query}`);
  const { reload: refetch } = list;
  useEffect(() => { if (refreshKey) refetch(); }, [refreshKey, refetch]);
  const { confirm, run } = useDialogs();
  const reload = useCallback(() => list.reload(), [list]);
  const [draft, setDraft] = useState<Record<string, FieldValue>>(() => ({ ...initialDraft(fields), ...defaults }));
  const [formKey, setFormKey] = useState(0);

  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorNote message={list.error} />;
  const rows = list.data ?? [];

  const save = (row: Row, key: string, value: FieldValue) => run(async () => { await api.put(`${resource}/${row.id}`, { [key]: value }); reload(); });
  const remove = async (row: Row) => {
    const grouped = !!row.group_id;
    const custom = removeMessage?.(row as never);
    const ok = await confirm(custom ?? (grouped ? 'Este item foi dividido entre as escolas. Excluir a divisão inteira (nas duas escolas)?' : 'Excluir este item?'));
    if (ok) await run(async () => { await api.del(`${resource}/${row.id}${grouped ? '?group=1' : ''}`); reload(); });
  };
  const add = () => run(async () => {
    await api.post(resource, { ...draft, ...extra });
    setDraft({ ...initialDraft(fields), ...defaults });
    setFormKey((k) => k + 1);
    reload();
  });

  const total = totalKey ? rows.reduce((s, r) => s + (Number(r[totalKey]) || 0) * (r.active === 0 ? 0 : 1), 0) : 0;

  return (
    <>
      <div className="card edit">
        <table>
          <thead>
            <tr>
              {fields.map((f) => <th key={f.key}>{f.label}</th>)}
              {extraColumns.map((c) => <th key={c.label}>{c.label}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {fields.map((f) => (
                  <td key={f.key}><FieldInput spec={f} value={row[f.key] as FieldValue} onCommit={(v) => save(row, f.key, v)} /></td>
                ))}
                {extraColumns.map((c) => <td key={c.label}>{c.render(row as never)}</td>)}
                <td className="actions">
                  {actions?.(row as never, { reload })}
                  {row.group_id && <span className="chip" title={`Compra dividida entre as escolas. Total ${brl(row.total_amount)}`}>dividido {pct((row.split_pct ?? 0) / 100)}</span>}
                  <button type="button" className="sec" onClick={() => remove(row)}>Excluir</button>
                </td>
              </tr>
            ))}
            {totalKey && (
              <tr className="tot">
                <td>Total</td>
                {fields.slice(1).map((f) => <td key={f.key}>{f.key === totalKey ? brl(total) : ''}</td>)}
                {extraColumns.map((c) => <td key={c.label} />)}
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="add" key={formKey}>
        {fields.map((f) => (
          <label key={f.key}>{f.label}
            <FieldInput spec={f} value={draft[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
          </label>
        ))}
        <button type="button" onClick={add}>Adicionar</button>
      </div>
    </>
  );
}

function initialDraft(fields: FieldSpec[]): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const f of fields) out[f.key] = f.type === 'select' ? (f.options?.[0]?.[0] ?? '') : f.type === 'bool' ? 0 : f.type === 'money' || f.type === 'num' ? null : '';
  return out;
}
