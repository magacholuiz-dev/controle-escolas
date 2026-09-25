import { Inject, Injectable } from '@nestjs/common';
import { hashPassword, InputError } from '@controle-escolas/domain';
import { MODEL } from '../database/models';
import type { AuditLogDoc, M, SessionDoc, UserDoc } from '../database/schemas';
import { AuditService } from '../common/audit.service';
import type { SessionUser } from '../common/session';
import { requireId, type Body } from '../common/validation';

const ROLES = ['owner', 'director'];

@Injectable()
export class UsersService {
  constructor(
    @Inject(MODEL.User) private readonly users: M<UserDoc>,
    @Inject(MODEL.Session) private readonly sessions: M<SessionDoc>,
    @Inject(MODEL.AuditLog) private readonly logs: M<AuditLogDoc>,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const users = await this.users.find().select('-password_hash').sort('email').lean();
    return users.map(({ _id, school_ids, ...u }) => ({ ...u, id: String(_id), school_ids: (school_ids ?? []).map(String) }));
  }

  async create(actor: SessionUser, { email, password, role, school_ids }: Body) {
    if (!email || !password) throw new InputError('email e senha são obrigatórios');
    if (!ROLES.includes(role as string)) throw new InputError('role deve ser owner ou director');
    if (String(password).length < 8) throw new InputError('senha deve ter ao menos 8 caracteres');
    const ids = role === 'director' ? ((school_ids as unknown[]) || []).map((sid) => requireId(sid, 'school_ids')) : [];
    if (role === 'director' && !ids.length) throw new InputError('diretora precisa de ao menos uma escola');
    const doc = await this.users.create({ email: String(email).toLowerCase().trim(), password_hash: hashPassword(String(password)), role: role as 'owner' | 'director', school_ids: ids });
    await this.audit.log(actor, 'user.create', { entity: 'User', entity_id: doc._id, after: { email: doc.email, role: doc.role, school_ids: ids } });
    return { id: String(doc._id) };
  }

  async update(actor: SessionUser, id: string, { role, school_ids, password }: Body) {
    const user = await this.users.findById(id);
    if (!user) throw new InputError('usuário não encontrado', 404);
    const before = { role: user.role, school_ids: (user.school_ids ?? []).map(String) };
    if (role !== undefined) {
      if (!ROLES.includes(role as string)) throw new InputError('role deve ser owner ou director');
      user.role = role as 'owner' | 'director';
    }
    if (school_ids !== undefined) user.school_ids = ((school_ids as unknown[]) || []).map((sid) => requireId(sid, 'school_ids')) as never;
    if (user.role === 'director' && !user.school_ids.length) throw new InputError('diretora precisa de ao menos uma escola');
    if (password) {
      if (String(password).length < 8) throw new InputError('senha deve ter ao menos 8 caracteres');
      user.password_hash = hashPassword(String(password));
    }
    await user.save();
    await this.audit.log(actor, 'user.update', { entity: 'User', entity_id: user._id, before, after: { role: user.role, school_ids: user.school_ids.map(String) } });
    return { ok: true };
  }

  async remove(actor: SessionUser, id: string) {
    if (String(actor.id) === String(id)) throw new InputError('não é possível excluir o próprio usuário logado');
    const removed = await this.users.findOneAndDelete({ _id: id });
    if (!removed) throw new InputError('usuário não encontrado', 404);
    await this.sessions.deleteMany({ user_id: removed._id });
    await this.audit.log(actor, 'user.delete', { entity: 'User', entity_id: removed._id, before: { email: removed.email, role: removed.role } });
    return { ok: true };
  }

  async auditLog(entityId?: string, schoolId?: string) {
    const filter: Record<string, unknown> = {};
    if (entityId) filter.entity_id = requireId(entityId, 'entity_id');
    if (schoolId) filter.school_id = requireId(schoolId, 'school_id');
    const logs = await this.logs.find(filter).sort({ at: -1, _id: -1 }).limit(500).lean();
    return logs.map(({ _id, ...l }) => ({ ...l, id: String(_id) }));
  }
}
