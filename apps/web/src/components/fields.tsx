'use client';
import { useEffect, useState } from 'react';
import { dateBrToIso, formatMoneyInput, formatNumberInput, isoToBr, isoToMonthBr, maskDateBr, maskMonthBr, monthBrToIso, parseNumberBr } from '@/lib/format';

export type FieldType = 'text' | 'money' | 'num' | 'date' | 'month' | 'select' | 'bool';
export type Option = [string | number, string];
export interface FieldSpec { key: string; label: string; type: FieldType; options?: Option[] }
export type FieldValue = string | number | null;

// What the input shows for a stored value: dates as dd/mm/aaaa, money as R$ 1.234,56, numbers with a decimal comma.
function display(spec: FieldSpec, value: FieldValue | undefined): string {
  if (value === undefined || value === null || value === '') return spec.type === 'select' ? String(spec.options?.[0]?.[0] ?? '') : '';
  if (spec.type === 'date') return isoToBr(String(value));
  if (spec.type === 'month') return isoToMonthBr(String(value));
  if (spec.type === 'money') return formatMoneyInput(Number(value));
  if (spec.type === 'num') return formatNumberInput(Number(value));
  return String(value);
}

// Reads what was typed back as the field's own type: ISO date, number, or null when empty/unreadable.
export function toValue(spec: FieldSpec, raw: string, checked: boolean): FieldValue {
  if (spec.type === 'bool') return checked ? 1 : 0;
  if (spec.type === 'money' || spec.type === 'num') return parseNumberBr(raw);
  if (spec.type === 'date') return raw === '' ? '' : dateBrToIso(raw);
  if (spec.type === 'month') return raw === '' ? '' : monthBrToIso(raw);
  if (spec.type === 'select') return spec.options?.find((o) => String(o[0]) === raw)?.[0] ?? raw;
  return raw;
}

interface Props {
  spec: FieldSpec;
  value: FieldValue | undefined;
  /** draft mode: called on every change */
  onChange?: (v: FieldValue) => void;
  /** edit mode: called when the person finishes editing (blur / select / checkbox) and the value changed */
  onCommit?: (v: FieldValue) => void;
  id?: string;
}

export function FieldInput({ spec, value, onChange, onCommit, id }: Props) {
  const [text, setText] = useState<string>(display(spec, value));
  const [checked, setChecked] = useState(!!value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setText(display(spec, value)); setChecked(!!value); setInvalid(false); }, [value, spec]);

  const aria = { id, 'aria-label': spec.label };

  if (spec.type === 'bool') {
    return (
      <input type="checkbox" {...aria} checked={checked} onChange={(e) => {
        setChecked(e.target.checked);
        const v = toValue(spec, '', e.target.checked);
        onChange?.(v); onCommit?.(v);
      }} />
    );
  }
  if (spec.type === 'select') {
    return (
      <select {...aria} value={text} onChange={(e) => {
        setText(e.target.value);
        const v = toValue(spec, e.target.value, false);
        onChange?.(v); onCommit?.(v);
      }}>
        {spec.options?.map(([v, label]) => <option key={String(v)} value={String(v)}>{label}</option>)}
      </select>
    );
  }

  const numeric = spec.type === 'money' || spec.type === 'num';
  const isDate = spec.type === 'date';
  const isMonth = spec.type === 'month';
  const change = (typed: string) => {
    const t = isDate ? maskDateBr(typed) : isMonth ? maskMonthBr(typed) : typed;
    setText(t); setInvalid(false);
    onChange?.(toValue(spec, t, false));
  };
  // Leaving the field: tidy the text into its canonical pt-BR shape and, in edit mode, save when valid and changed.
  const blur = () => {
    const v = toValue(spec, text, false);
    if (text !== '' && v === null) { setInvalid(true); return; }
    setInvalid(false);
    if (v !== null && v !== '' && numeric) setText(display(spec, v));
    const before = value === undefined || value === null ? '' : value;
    if (onCommit && (v ?? '') !== before) onCommit(v);
  };
  return (
    <input
      {...aria}
      type="text"
      inputMode={isDate || isMonth ? 'numeric' : numeric ? 'decimal' : undefined}
      placeholder={isDate ? 'dd/mm/aaaa' : isMonth ? 'mm/aaaa' : spec.type === 'money' ? 'R$ 0,00' : spec.type === 'num' ? '0' : undefined}
      maxLength={isDate ? 10 : isMonth ? 7 : undefined}
      aria-invalid={invalid || undefined}
      value={text}
      onChange={(e) => change(e.target.value)}
      onBlur={blur}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}
