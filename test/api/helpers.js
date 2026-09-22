// Boots the API in-process against a disposable Mongo database (one per test file).
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { connect } from '../../db.js';
import { createApp } from '../../server.js';

const MONGO_TEST_HOST = process.env.MONGO_TEST_HOST || 'mongodb://127.0.0.1:27019';

export async function start() {
  // `node --test` runs test files in parallel: process.pid + Date.now() can collide between two
  // files calling start() in the same millisecond, making two files accidentally share the same
  // database. randomBytes guarantees a database unique to this call.
  const database = `controle-escolas-test-${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}`;
  await connect(`${MONGO_TEST_HOST}/${database}`);
  const server = createApp();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;

  // Response is always { status, body }, even when the body isn't JSON.
  const req = async (method, path, body, { raw = false } = {}) => {
    const r = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    const text = await r.text();
    let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: r.status, body: parsed };
  };

  return {
    req,
    async schools() { return (await req('GET', '/api/schools')).body; },
    async stop() {
      await new Promise((ok) => server.close(ok));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    },
  };
}
