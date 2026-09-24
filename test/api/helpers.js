// Boots the API in-process against a disposable Mongo database (one per test file). Every test
// file needs a logged-in session since Loop 8 (owner/director auth) — `start()` seeds an owner user
// and logs in automatically, so existing business-logic tests keep working unauthenticated-free;
// tests that exercise auth itself pass `{ cookie: '' }` (no session) or log in as a director.
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { connect } from '../../db.js';
import { createApp } from '../../server.js';

const MONGO_TEST_HOST = process.env.MONGO_TEST_HOST || 'mongodb://127.0.0.1:27019';
const OWNER_EMAIL = 'owner@test.local';
const OWNER_PASSWORD = 'owner-test-password';

export async function start() {
  // `node --test` runs test files in parallel: process.pid + Date.now() can collide between two
  // files calling start() in the same millisecond, making two files accidentally share the same
  // database. randomBytes guarantees a database unique to this call.
  const database = `controle-escolas-test-${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}`;
  process.env.SEED_OWNER_EMAIL = OWNER_EMAIL;
  process.env.SEED_OWNER_PASSWORD = OWNER_PASSWORD;
  await connect(`${MONGO_TEST_HOST}/${database}`);
  const server = createApp();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;

  const rawReq = async (method, path, body, { raw = false, cookie } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    const r = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    const text = await r.text();
    let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: r.status, body: parsed, headers: r.headers };
  };

  // Logs in and returns just the `sid=...` cookie (no attributes), ready to reuse as `{ cookie }`.
  const loginAs = async (email, password) => {
    const r = await rawReq('POST', '/api/auth/login', { email, password });
    if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
    const setCookie = r.headers.get('set-cookie') || '';
    return setCookie.split(';')[0];
  };

  const ownerCookie = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);

  // Response is always { status, body }, even when the body isn't JSON. Defaults to the owner's
  // session; pass `{ cookie: '' }` for no session, or a director's cookie from `loginAs`.
  const req = (method, path, body, opts = {}) => rawReq(method, path, body, { cookie: ownerCookie, ...opts });

  return {
    req, loginAs, ownerCookie,
    async schools() { return (await req('GET', '/api/schools')).body; },
    async stop() {
      await new Promise((ok) => server.close(ok));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    },
  };
}
