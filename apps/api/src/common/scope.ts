import { InputError } from '@controle-escolas/domain';
import type { SessionUser } from './session';

// One place decides whether a request may touch a school. `allowedIds` null means unrestricted.
export function checkAllowed(allowedIds: string[] | null, schoolId: unknown): void {
  if (allowedIds && !allowedIds.map(String).includes(String(schoolId))) throw new InputError('acesso não permitido a esta escola', 403);
}

export function requireOwner(user: SessionUser, message: string): void {
  if (user.role !== 'owner') throw new InputError(message, 403);
}
