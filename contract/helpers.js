// HTTP contract-test harness. Every suite here talks to the API only through HTTP, so the same
// files verify any implementation of it (the legacy JS server, the NestJS API, ...).
//
// Each `start()` spawns its own server process (API_CMD, default: the legacy server) against a
// disposable Mongo database, seeds an owner, logs in as that owner and gives back `req()`.
// Tests that exercise auth itself pass `{ cookie: '' }` (no session) or log in as a director.
import { spawn } from 'node:child_process';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import mongoose from 'mongoose';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MONGO_TEST_HOST = process.env.MONGO_TEST_HOST || 'mongodb://127.0.0.1:27019';
const API_CMD = process.env.API_CMD || 'node legacy/server.js';
const OWNER_EMAIL = 'owner@test.local';
const OWNER_PASSWORD = 'owner-test-password';

const freePort = () => new Promise((ok, fail) => {
  const s = net.createServer();
  s.once('error', fail);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
});

async function waitUntilUp(base, child, logs) {
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`API process exited early (${child.exitCode}):\n${logs.join('')}`);
    try { await fetch(`${base}/api/auth/me`); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error(`API did not start in time:\n${logs.join('')}`);
}

export async function start() {
  // `node --test` runs files in parallel; random bytes guarantee a database unique to this call.
  const database = `controle-escolas-test-${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const uri = `${MONGO_TEST_HOST}/${database}`;
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const logs = [];
  const [cmd, ...args] = API_CMD.split(' ');
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: {
      ...process.env, PORT: String(port), LISTEN_HOST: '127.0.0.1', MONGODB_URI: uri,
      SEED_OWNER_EMAIL: OWNER_EMAIL, SEED_OWNER_PASSWORD: OWNER_PASSWORD, COOKIE_SECURE: '0', CORS_ORIGINS: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  await waitUntilUp(base, child, logs);

  const rawReq = async (method, path, body, { raw = false, cookie, headers: extraHeaders } = {}) => {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (cookie) headers.Cookie = cookie;
    const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
    const text = await r.text();
    let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: r.status, body: parsed, headers: r.headers };
  };

  // Logs in and returns just the `sid=...` cookie (no attributes), ready to reuse as `{ cookie }`.
  const loginAs = async (email, password) => {
    const r = await rawReq('POST', '/api/auth/login', { email, password });
    if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
    return (r.headers.get('set-cookie') || '').split(';')[0];
  };

  const ownerCookie = await loginAs(OWNER_EMAIL, OWNER_PASSWORD);
  // Defaults to the owner's session; `{ cookie: '' }` means no session.
  const req = (method, path, body, opts = {}) => rawReq(method, path, body, { cookie: ownerCookie, ...opts });

  return {
    req, loginAs, ownerCookie, base,
    async schools() { return (await req('GET', '/api/schools')).body; },
    async stop() {
      child.kill('SIGTERM');
      await new Promise((ok) => { if (child.exitCode !== null) ok(); else child.once('exit', ok); });
      const conn = await mongoose.createConnection(uri).asPromise();
      await conn.dropDatabase();
      await conn.close();
    },
  };
}
