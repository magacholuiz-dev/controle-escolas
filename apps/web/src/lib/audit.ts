import { AUDIT_ACTION_LABELS, AUDIT_FIELD_LABELS } from './messages';
import { brl } from './format';

export const auditActionLabel = (action: string): string => AUDIT_ACTION_LABELS[action] ?? action;

const value = (v: unknown): string => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : brl(v)) : v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const describe = (o: unknown): string =>
  Object.entries((o ?? {}) as Record<string, unknown>).map(([k, v]) => `${AUDIT_FIELD_LABELS[k] ?? k}: ${value(v)}`).join(', ');
const filled = (o: unknown): boolean => !!o && typeof o === 'object' && Object.keys(o as object).length > 0;

// Human-readable "before → after" for the activity log.
export function auditDetail(before: unknown, after: unknown): string {
  if (filled(before) && filled(after)) return `${describe(before)} → ${describe(after)}`;
  if (filled(after)) return describe(after);
  if (filled(before)) return describe(before);
  return '—';
}
