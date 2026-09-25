import { Inject, Injectable } from '@nestjs/common';
import {
  createSessionToken, InputError, isLocked, recordFailedAttempt, verifyPassword,
} from '@controle-escolas/domain';
import { MODEL } from '../database/models';
import type { M, SessionDoc, UserDoc } from '../database/schemas';
import type { SessionUser } from '../common/session';
import { env } from '../config/env';

const toSessionUser = (u: { _id: unknown; email: string; role: 'owner' | 'director'; school_ids?: unknown[] }): SessionUser => ({
  id: String(u._id), email: u.email, role: u.role, school_ids: (u.school_ids ?? []).map(String),
});

@Injectable()
export class AuthService {
  constructor(
    @Inject(MODEL.User) private readonly users: M<UserDoc>,
    @Inject(MODEL.Session) private readonly sessions: M<SessionDoc>,
  ) {}

  async userFromToken(token: string | undefined): Promise<SessionUser | null> {
    if (!token) return null;
    const session = await this.sessions.findOne({ token, expires_at: { $gt: new Date() } }).lean();
    if (!session) return null;
    const user = await this.users.findById(session.user_id).lean();
    return user ? toSessionUser(user) : null;
  }

  async login(email: unknown, password: unknown): Promise<{ token: string; maxAgeSeconds: number; user: SessionUser }> {
    if (!email || !password) throw new InputError('email e senha são obrigatórios');
    const user = await this.users.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) throw new InputError('email ou senha inválidos', 401);
    if (isLocked(user)) throw new InputError('conta bloqueada temporariamente após várias tentativas erradas; tente novamente mais tarde', 423);
    if (!verifyPassword(String(password), user.password_hash)) {
      const { failed_attempts, locked_until } = recordFailedAttempt(user);
      await this.users.updateOne({ _id: user._id }, { $set: { failed_attempts, locked_until } });
      throw new InputError('email ou senha inválidos', 401);
    }
    if (user.failed_attempts) await this.users.updateOne({ _id: user._id }, { $set: { failed_attempts: 0, locked_until: null } });
    const token = createSessionToken();
    await this.sessions.create({ token, user_id: user._id, expires_at: new Date(Date.now() + env.sessionTtlHours * 3600000) });
    return { token, maxAgeSeconds: env.sessionTtlHours * 3600, user: toSessionUser(user) };
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.sessions.deleteOne({ token });
  }
}
