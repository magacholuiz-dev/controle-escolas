import type { Request } from 'express';

export interface SessionUser { id: string; email: string; role: 'owner' | 'director'; school_ids: string[] }
export type AuthedRequest = Request & { user?: SessionUser };

// null = unrestricted (owner); otherwise the schools this user may touch.
export const allowedSchoolIds = (user: SessionUser): string[] | null => (user.role === 'owner' ? null : user.school_ids);
