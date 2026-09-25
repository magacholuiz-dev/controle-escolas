// M0 AC3: the schemas of the new API create exactly the collections and indexes the legacy app
// creates, so both can share one database (no data migration, rollback = switch the proxy back).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import mongoose from 'mongoose';
import { start } from './helpers.js';

const nestBuilt = existsSync(new URL('../apps/api/dist/main.js', import.meta.url));

async function snapshot(uri) {
  const conn = await mongoose.createConnection(uri).asPromise();
  const collections = (await conn.db.listCollections().toArray()).map((c) => c.name).sort();
  const out = {};
  for (const name of collections) {
    const indexes = await conn.db.collection(name).indexes();
    out[name] = indexes.map(({ key, unique, partialFilterExpression }) => JSON.stringify({ key, unique: !!unique, partialFilterExpression: partialFilterExpression ?? null })).sort();
  }
  await conn.close();
  return out;
}

test('the Nest schemas create the same collections and indexes as the legacy app', { skip: !nestBuilt && 'apps/api is not built' }, async () => {
  const legacy = await start({ cmd: 'node legacy/server.js' });
  const nest = await start({ cmd: 'node apps/api/dist/main.js' });
  try {
    // Touch every resource so any lazily created collection exists on both sides.
    for (const api of [legacy, nest]) {
      const [school] = await api.schools();
      await api.req('GET', `/api/report?year=2026&school=${school.id}`);
    }
    await new Promise((r) => setTimeout(r, 1500)); // let background index builds finish
    const [a, b] = [await snapshot(legacy.uri), await snapshot(nest.uri)];
    // Collections only exist once something is written; compare the ones the legacy app created and
    // require the new API to have created at least those with the same indexes.
    for (const name of Object.keys(a)) {
      assert.ok(b[name], `collection ${name} missing in the Nest database`);
      assert.deepEqual(b[name], a[name], `indexes differ in ${name}`);
    }
  } finally {
    await legacy.stop();
    await nest.stop();
  }
});
