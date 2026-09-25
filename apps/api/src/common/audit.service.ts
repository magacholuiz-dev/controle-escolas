import { Inject, Injectable } from '@nestjs/common';
import { MODEL } from '../database/models';
import type { AuditLogDoc, M } from '../database/schemas';
import type { SessionUser } from './session';

export interface AuditDetail {
  entity?: string;
  entity_id?: unknown;
  school_id?: unknown;
  before?: unknown;
  after?: unknown;
}

// A short, human-readable snapshot of a document for the audit log — just enough to recognize
// "which one" without dumping every field.
const SUMMARY_FIELDS: Record<string, string[]> = {
  employees: ['name', 'role', 'salary'],
  revenues: ['description', 'monthly_amount'],
  expenses: ['description', 'monthly_amount'],
  entries: ['description', 'amount', 'category'],
  schools: ['name'],
  children: ['name'],
  tuition: ['base_amount', 'discount'],
  suppliers: ['name'],
  scenarios: ['name'],
  bills: ['description', 'amount'],
};

export function docSummary(resource: string, doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of SUMMARY_FIELDS[resource] ?? []) if (doc[f] !== undefined) out[f] = doc[f];
  return out;
}

// Only the fields that actually changed, so a log entry doesn't repeat every column on every edit.
export function changedFields(data: Record<string, unknown>, existing: Record<string, unknown>) {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const k of Object.keys(data)) {
    if (JSON.stringify(data[k]) !== JSON.stringify(existing[k])) { before[k] = existing[k]; after[k] = data[k]; }
  }
  return { before, after, hasChanges: Object.keys(after).length > 0 };
}

@Injectable()
export class AuditService {
  constructor(@Inject(MODEL.AuditLog) private readonly logs: M<AuditLogDoc>) {}

  async log(user: Pick<SessionUser, 'email'>, action: string, d: AuditDetail = {}): Promise<void> {
    await this.logs.create({
      user_email: user.email, action, entity: d.entity ?? '', entity_id: (d.entity_id ?? null) as never,
      school_id: (d.school_id ?? null) as never, before: d.before ?? null, after: d.after ?? null,
    });
  }
}
