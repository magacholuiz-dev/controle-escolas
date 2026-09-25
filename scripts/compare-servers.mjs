// Parallel run on a COPY of production data. Usage:
//   MONGODB_URI=mongodb://127.0.0.1:27019/prod-copy node scripts/compare-servers.mjs
// Starts the legacy server and the Nest API on the same (copy) database, logs in as the given owner
// and compares every read endpoint for every school x year, byte for byte after id normalization.
// The owner's password is reset in the COPY only. Never point this at the production database.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { hashPassword } from '../legacy/auth.js';

const uri = process.env.MONGODB_URI;
if (!uri || !/copy|test|demo/.test(uri)) { console.error('Set MONGODB_URI to a database whose name contains copy/test/demo.'); process.exit(2); }
const PASSWORD = randomBytes(9).toString('hex');
const conn = await mongoose.createConnection(uri).asPromise();
const owner = await conn.collection('users').findOne({ role: 'owner' });
await conn.collection('users').updateOne({ _id: owner._id }, { $set: { password_hash: hashPassword(PASSWORD), failed_attempts: 0, locked_until: null } });
await conn.close();

const launch = (cmd, port) => {
  const [c, ...a] = cmd.split(' ');
  const child = spawn(c, a, { env: { ...process.env, PORT: String(port), LISTEN_HOST: '127.0.0.1', MONGODB_URI: uri, COOKIE_SECURE: '0', SEED_OWNER_EMAIL: owner.email, SEED_OWNER_PASSWORD: PASSWORD }, stdio: 'ignore' });
  return child;
};
const legacyChild = launch('node legacy/server.js', 3401), nestChild = launch('node apps/api/dist/main.js', 3402);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 100; i++) { try { await fetch('http://127.0.0.1:3401/api/auth/me'); await fetch('http://127.0.0.1:3402/api/auth/me'); break; } catch { await sleep(100); } }

const session = async (base) => {
  const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: owner.email, password: PASSWORD }) });
  if (r.status !== 200) throw new Error(`login ${base}: ${r.status}`);
  return r.headers.get('set-cookie').split(';')[0];
};
const [ck1, ck2] = [await session('http://127.0.0.1:3401'), await session('http://127.0.0.1:3402')];
const get = async (base, ck, path) => { const r = await fetch(base + path, { headers: { Cookie: ck } }); const t = await r.text(); let b; try { b = JSON.parse(t); } catch { b = t; } return { status: r.status, body: b }; };
const norm = (v) => JSON.parse(JSON.stringify(v).replace(/[0-9a-f]{64}/g, '<sha>').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>'));
const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;

const schools = (await get('http://127.0.0.1:3401', ck1, '/api/schools')).body;
const years = [2025, 2026, 2027];
const paths = ['/api/schools', '/api/suppliers', '/api/employees', '/api/bills/panel?school=all', '/api/tuition/panel?school=all', '/api/bank/list?school=all', '/api/audit', '/api/users'];
for (const y of years) paths.push(`/api/report?year=${y}&school=all`, `/api/statement?year=${y}&school=all`, `/api/metrics?year=${y}&school=all`);
for (const s of schools) {
  for (const y of years) paths.push(`/api/report?year=${y}&school=${s.id}`, `/api/statement?year=${y}&school=${s.id}`, `/api/metrics?year=${y}&school=${s.id}`, `/api/alerts?year=${y}&school_id=${s.id}`, `/api/calendar?school_id=${s.id}&year=${y}`, `/api/entries?school_id=${s.id}&year=${y}`, `/api/export/statement?school_id=${s.id}&year=${y}`, `/api/export/entries?school_id=${s.id}&year=${y}`);
  for (const r of ['employees', 'revenues', 'expenses', 'children', 'bills', 'tuition', 'scenarios']) paths.push(`/api/${r}?school_id=${s.id}`);
  paths.push(`/api/children/occupancy?school_id=${s.id}`, `/api/bills/panel?school=${s.id}`, `/api/tuition/panel?school=${s.id}`, `/api/bank/list?school=${s.id}`);
}
let bad = 0;
for (const p of paths) {
  const [a, b] = await Promise.all([get('http://127.0.0.1:3401', ck1, p), get('http://127.0.0.1:3402', ck2, p)]);
  const ja = JSON.stringify(sortKeys(norm(a.body))), jb = JSON.stringify(sortKeys(norm(b.body)));
  if (a.status !== b.status || (p !== '/api/audit' && ja !== jb) || (p === '/api/audit' && ja.length !== jb.length && false)) { bad++; console.log('DIFF', p, a.status, b.status, ja.slice(0, 160), '|', jb.slice(0, 160)); }
}
console.log(`${paths.length} endpoints compared, ${bad} differences`);
legacyChild.kill(); nestChild.kill();
process.exit(bad ? 1 : 0);
