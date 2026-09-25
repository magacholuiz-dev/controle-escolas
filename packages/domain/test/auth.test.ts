import { test } from 'vitest';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, createSessionToken, isLocked, recordFailedAttempt, canAccessSchool } from '../src/auth';

test('auth: legacy assertions, ported 1:1', () => {

  // AC5 (indirectly): the stored form is never the plain password, and it round-trips.
  const stored = hashPassword('correct-horse-battery-staple');
  assert.ok(!stored.includes('correct-horse-battery-staple'));
  assert.ok(verifyPassword('correct-horse-battery-staple', stored));
  assert.ok(!verifyPassword('wrong-password', stored));
  assert.ok(!verifyPassword('correct-horse-battery-staple', 'not-a-valid-stored-value'));
  assert.ok(!verifyPassword('correct-horse-battery-staple', ''));

  // Two hashes of the same password are never identical (random salt) but both verify.
  const stored2 = hashPassword('correct-horse-battery-staple');
  assert.notEqual(stored, stored2);
  assert.ok(verifyPassword('correct-horse-battery-staple', stored2));

  // Session tokens: long, hex, and never repeat.
  const t1 = createSessionToken();
  const t2 = createSessionToken();
  assert.equal(t1.length, 64);
  assert.match(t1, /^[0-9a-f]+$/);
  assert.notEqual(t1, t2);

  // AC4: 6 failed attempts lock the account for 15 minutes; earlier attempts don't.
  let user = {};
  for (let i = 0; i < 5; i++) { user = { ...user, ...recordFailedAttempt(user) }; assert.equal(isLocked(user), false); }
  user = { ...user, ...recordFailedAttempt(user) };
  assert.equal(user.failed_attempts, 6);
  assert.equal(isLocked(user), true);
  assert.ok(new Date(user.locked_until) - Date.now() > 14 * 60000);

  // AC2: owner reaches every school; a director only reaches her own.
  const owner = { role: 'owner', school_ids: [] };
  const director = { role: 'director', school_ids: ['s1'] };
  assert.ok(canAccessSchool(owner, 's1'));
  assert.ok(canAccessSchool(owner, 's2'));
  assert.ok(canAccessSchool(director, 's1'));
  assert.ok(!canAccessSchool(director, 's2'));


});
