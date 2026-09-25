import type { Request, Response } from 'express';
import { env } from '../config/env';

export const parseCookies = (header: string | undefined): Record<string, string> =>
  Object.fromEntries(String(header || '').split(';').filter(Boolean).map((p) => {
    const i = p.indexOf('=');
    return [p.slice(0, i).trim(), decodeURIComponent(p.slice(i + 1).trim())];
  }));

// SameSite=Strict only works when front and API share a site; behind a proxy with HTTPS the cookie is
// Secure, and SameSite=None keeps it working if the API is ever reached cross-site.
const sameSite = env.cookieSecure ? 'None' : 'Strict';
const attrs = (maxAge: number): string => `Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${env.cookieSecure ? '; Secure' : ''}`;

export const setSessionCookie = (res: Response, token: string, maxAgeSeconds: number): void => { res.setHeader('Set-Cookie', `sid=${token}; ${attrs(maxAgeSeconds)}`); };
export const clearSessionCookie = (res: Response): void => { res.setHeader('Set-Cookie', `sid=; ${attrs(0)}`); };
export const sessionToken = (req: Request): string | undefined => parseCookies(req.headers.cookie).sid;
