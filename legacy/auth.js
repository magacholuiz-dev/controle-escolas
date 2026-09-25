// Password hashing and session tokens. Pure/testable, no HTTP or DB here — the server wires this
// into cookies and Mongo documents.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 64;

// Stored as "salt:hash", both hex. scrypt's cost parameters are the library defaults — fine for a
// small user base, and there's no native dependency to compile.
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

// Constant-time comparison: a plain `===` on the derived hash would leak timing information about
// how many leading bytes matched.
export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEY_LEN) return false;
  const actual = scryptSync(password, salt, KEY_LEN);
  return timingSafeEqual(actual, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString('hex');
}

// True when a user's account is currently locked out from too many failed attempts.
export function isLocked(user) {
  return !!(user.locked_until && new Date(user.locked_until) > new Date());
}

const MAX_ATTEMPTS = 6;
const LOCK_MINUTES = 15;

// Pure decision: given the current attempt count, what should the user document become after one
// more failed login? The caller persists it.
export function recordFailedAttempt(user) {
  const failed_attempts = (user.failed_attempts || 0) + 1;
  const locked_until = failed_attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : (user.locked_until || null);
  return { failed_attempts, locked_until };
}

// True when a user (given their role/school_ids) may access the given school id. `owner` always can.
export function canAccessSchool(user, schoolId) {
  if (user.role === 'owner') return true;
  return (user.school_ids || []).map(String).includes(String(schoolId));
}
