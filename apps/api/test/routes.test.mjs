// Router-enumerating access probe (run against the built app: `npm run build && npm run test:routes`).
// Every route Nest registers must answer 401 without a session, except the three auth routes, so a
// new controller can never ship without the guard. Owner-only routes answer 403 to a director, and a
// director cannot reach the other school. (Runs under node:test, not Jest: Jest's VM sandbox breaks
// the MongoDB driver's client metadata.)
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getConnectionToken } from '@nestjs/mongoose';

const DB = `controle-escolas-routes-${process.pid}-${Date.now()}`;
process.env.MONGODB_URI = `${process.env.MONGO_TEST_HOST ?? 'mongodb://127.0.0.1:27019'}/${DB}`;
process.env.SEED_OWNER_EMAIL = 'owner@probe.local';
process.env.SEED_OWNER_PASSWORD = 'owner-password-1';

const PUBLIC = new Set(['POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/auth/me']);
const OWNER_ONLY = ['GET /api/users', 'POST /api/users', 'GET /api/audit', 'POST /api/split'];
const ID = '6ab2e08b6dce41df032284fc';

const { createApp } = createRequire(import.meta.url)('../dist/main.js');
let app, base, routes;

before(async () => {
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  const stack = app.getHttpAdapter().getInstance().router.stack ?? [];
  routes = stack.filter((l) => l.route).flatMap((l) => Object.keys(l.route.methods).map((m) => `${m.toUpperCase()} ${l.route.path}`));
});
after(async () => {
  await app.get(getConnectionToken()).dropDatabase();
  await app.close();
});

const call = (route, cookie = '') => {
  const [method, path] = route.split(' ');
  return fetch(base + path.replace(/:\w+/g, ID), {
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
  });
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).headers.get('set-cookie').split(';')[0];

test('the enumeration finds the routes (a sanity check on the probe itself)', () => {
  assert.ok(routes.length > 60, `only ${routes.length} routes found`);
  for (const r of PUBLIC) assert.ok(routes.includes(r), `${r} missing`);
});

test('every route except login/logout/me answers 401 without a session', async () => {
  const open = [];
  for (const route of routes.filter((r) => !PUBLIC.has(r) && !/^(OPTIONS|HEAD) /.test(r))) {
    const res = await call(route);
    if (res.status !== 401) open.push(`${route} -> ${res.status}`);
  }
  assert.deepEqual(open, []);
});

test('owner-only routes refuse a director (403) and a director cannot reach the other school', async () => {
  const ownerCookie = await login('owner@probe.local', 'owner-password-1');
  const schools = await (await fetch(`${base}/api/schools`, { headers: { Cookie: ownerCookie } })).json();
  await fetch(`${base}/api/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
    body: JSON.stringify({ email: 'dir@probe.local', password: 'director-pass-1', role: 'director', school_ids: [schools[1].id] }),
  });
  const dir = await login('dir@probe.local', 'director-pass-1');
  for (const route of OWNER_ONLY) assert.equal((await call(route, dir)).status, 403, route);
  assert.equal((await fetch(`${base}/api/employees?school_id=${schools[0].id}`, { headers: { Cookie: dir } })).status, 403);
  assert.equal((await fetch(`${base}/api/employees?school_id=${schools[1].id}`, { headers: { Cookie: dir } })).status, 200);
});
