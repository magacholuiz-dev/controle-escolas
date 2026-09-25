// Starts the Nest API on a fresh database for the e2e run (drops the previous one first).
import { spawn } from 'node:child_process';
import mongoose from 'mongoose';

const host = process.env.MONGO_TEST_HOST ?? 'mongodb://127.0.0.1:27019';
const uri = `${host}/controle-escolas-e2e`;
const conn = await mongoose.createConnection(uri).asPromise();
await conn.dropDatabase();
await conn.close();

const child = spawn('node', ['../api/dist/main.js'], {
  stdio: 'inherit',
  env: { ...process.env, MONGODB_URI: uri, PORT: '3210', LISTEN_HOST: '127.0.0.1', SEED_OWNER_EMAIL: 'dona@e2e.local', SEED_OWNER_PASSWORD: 'e2e-password-1', COOKIE_SECURE: '0' },
});
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
