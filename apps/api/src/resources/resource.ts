// Generic CRUD over one collection, faithful to the legacy behavior: a whitelist of writable
// fields, school scoping in one place, an optional validation hook, and an audit entry per write.
import type { Model } from 'mongoose';
import { billStatus, InputError, overdueBracket } from '@controle-escolas/domain';
import { AuditService, changedFields, docSummary } from '../common/audit.service';
import { checkAllowed } from '../common/scope';
import { pickFields, requireId, requireYear, type Body } from '../common/validation';
import type { SessionUser } from '../common/session';

export type AnyModel = Model<Record<string, unknown>>;
type Doc = Record<string, unknown>;

export interface ResourceConfig {
  name: string;
  model: AnyModel;
  cols: readonly string[];
  /** false for schools (scoped by their own id) and suppliers (shared) */
  scoped: boolean;
  /** rows carry a due date: listed with a derived status, ordered by due date */
  hasDueDate?: boolean;
  validate?: (data: Body, existing?: Doc | null) => Promise<void>;
}

const today = (): string => new Date().toISOString().slice(0, 10);

export class Resource {
  constructor(readonly config: ResourceConfig, private readonly audit: AuditService) {}

  get name(): string { return this.config.name; }

  async list(query: Record<string, unknown>, allowedIds: string[] | null): Promise<unknown> {
    const { name, model, scoped, hasDueDate } = this.config;
    const filter: Record<string, unknown> = {};
    if (name === 'schools') { if (allowedIds) filter._id = { $in: allowedIds }; }
    else if (scoped) {
      if (query.school_id) { checkAllowed(allowedIds, requireId(query.school_id, 'school_id')); filter.school_id = query.school_id; }
      else if (allowedIds) filter.school_id = { $in: allowedIds };
    }
    if (name === 'entries' && query.year) filter.date = { $regex: `^${requireYear(query.year)}-` };
    if (hasDueDate && query.period) filter.period = query.period;
    const order: Record<string, 1 | -1> = name === 'entries' ? { date: -1, _id: -1 } : hasDueDate ? { due_date: 1, _id: 1 } : { _id: 1 };
    if (!hasDueDate) return model.find(filter).sort(order);
    const now = today();
    const docs = await model.find(filter).sort(order).lean();
    return docs.map(({ _id, ...c }) => ({
      ...c, id: String(_id),
      status: name === 'bills'
        ? billStatus(c as unknown as { paid_at?: string | null; due_date: string }, now)
        : (c.paid_at ? 'paid' : overdueBracket(c.due_date as string, now, false)),
    }));
  }

  async create(user: SessionUser, allowedIds: string[] | null, body: Body): Promise<{ id: string }> {
    const { name, model, cols, scoped, validate } = this.config;
    if (name === 'schools' && user.role !== 'owner') throw new InputError('só a dona pode cadastrar uma nova escola', 403);
    const data = pickFields(cols, body);
    if (scoped && data.school_id) checkAllowed(allowedIds, requireId(data.school_id, 'school_id'));
    await validate?.(data);
    const doc = await model.create(data);
    await this.audit.log(user, `${name}.create`, {
      entity: name, entity_id: doc._id, school_id: doc.school_id ?? (name === 'schools' ? doc._id : null), after: docSummary(name, doc as unknown as Doc),
    });
    return { id: String(doc._id) };
  }

  async update(user: SessionUser, allowedIds: string[] | null, id: string, body: Body): Promise<{ ok: true }> {
    const { name, model, cols, scoped, validate } = this.config;
    if (name === 'schools') checkAllowed(allowedIds, id);
    const data = pickFields(cols, body);
    const existing = await model.findById(id).lean() as Doc | null;
    if (!existing) throw new InputError('não encontrado', 404);
    if (scoped) {
      checkAllowed(allowedIds, existing.school_id);
      if (data.school_id) checkAllowed(allowedIds, requireId(data.school_id, 'school_id'));
    }
    await validate?.(data, existing);
    await model.updateOne({ _id: id }, { $set: data }, { runValidators: true });
    const { before, after, hasChanges } = changedFields(data, existing);
    if (hasChanges) {
      await this.audit.log(user, `${name}.update`, { entity: name, entity_id: id, school_id: existing.school_id ?? (name === 'schools' ? id : null), before, after });
    }
    return { ok: true };
  }

  async remove(user: SessionUser, allowedIds: string[] | null, id: string, query: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { name, model, scoped } = this.config;
    if (name === 'schools') throw new InputError('não é possível excluir escolas');
    const doc = await model.findById(id);
    if (!doc) throw new InputError('não encontrado', 404);
    if (scoped) checkAllowed(allowedIds, doc.school_id);
    const plain = doc.toObject() as Doc;
    if (query.installments && doc.installment_group_id) {
      const removed = await model.deleteMany({ installment_group_id: doc.installment_group_id, paid_at: null });
      await this.audit.log(user, 'bills.installments_delete', {
        entity: 'bills', entity_id: doc._id, school_id: doc.school_id, before: { description: doc.description, parcelas_removidas: removed.deletedCount },
      });
      return { ok: true, removed: removed.deletedCount };
    }
    if (query.group && doc.group_id) {
      const removed = await model.deleteMany({ group_id: doc.group_id });
      await this.audit.log(user, `${name}.delete`, {
        entity: name, entity_id: doc._id, school_id: doc.school_id, before: { ...docSummary(name, plain), group_id: doc.group_id, group_removed: removed.deletedCount },
      });
      return { ok: true, removed: removed.deletedCount };
    }
    const removedDoc = await model.findOneAndDelete({ _id: id });
    if (!removedDoc) throw new InputError('não encontrado', 404);
    await this.audit.log(user, `${name}.delete`, { entity: name, entity_id: id, school_id: removedDoc.school_id, before: docSummary(name, removedDoc.toObject() as Doc) });
    return { ok: true };
  }
}
