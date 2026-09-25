import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.js';

let api;

before(async () => { api = await start(); });
after(() => api.stop());

test('a *.vercel.app origin gets CORS headers with credentials allowed; an unrecognized origin does not', async () => {
  const allowed = await api.req('GET', '/api/schools', undefined, { headers: { Origin: 'https://controle-escolas-abc123.vercel.app' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://controle-escolas-abc123.vercel.app');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');

  const blocked = await api.req('GET', '/api/schools', undefined, { headers: { Origin: 'https://evil.example.com' } });
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
});

test('an OPTIONS preflight on /api/* is answered without auth and without hitting the route', async () => {
  const r = await api.req('OPTIONS', '/api/employees', undefined, { cookie: '', headers: { Origin: 'https://controle-escolas-abc123.vercel.app' } });
  assert.equal(r.status, 204);
  assert.match(r.headers.get('access-control-allow-methods') || '', /POST/);
});
