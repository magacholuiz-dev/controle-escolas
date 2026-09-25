'use client';
import { useEffect, useState } from 'react';

export type FieldType = 'text' | 'money' | 'num' | 'date' | 'select' | 'bool';
export type Option = [string | number, string];
export interface FieldSpec { key: string; label: string; type: FieldType; options?: Option[] }
export type FieldValue = string | number | null;

const isNumeric = (t: FieldType): boolean => t === 'money' || t === 'num';

// Reads the DOM value back as the field's own type ('' becomes null for numbers).
export function toValue(spec: FieldSpec, raw: string, checked: boolean): FieldValue {
  if (spec.type === 'bool') return checked ? 1 : 0;
  if (isNumeric(spec.type)) return raw === '' ? null : Number(raw);
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
  const initial = value ?? (spec.type === 'select' ? (spec.options?.[0]?.[0] ?? '') : '');
  const [text, setText] = useState<string>(String(initial));
  const [checked, setChecked] = useState(!!value);
  useEffect(() => { setText(String(value ?? (spec.type === 'select' ? (spec.options?.[0]?.[0] ?? '') : ''))); setChecked(!!value); }, [value, spec.type, spec.options]);

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
  return (
    <input
      {...aria}
      type={isNumeric(spec.type) ? 'number' : spec.type === 'date' ? 'date' : 'text'}
      step={isNumeric(spec.type) ? '0.01' : undefined}
      value={text}
      onChange={(e) => { setText(e.target.value); onChange?.(toValue(spec, e.target.value, false)); }}
      onBlur={() => { if (onCommit && text !== String(value ?? '')) onCommit(toValue(spec, text, false)); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}
