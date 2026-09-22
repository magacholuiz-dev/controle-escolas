// Sobe a API em processo contra um banco Mongo descartável (um por arquivo de teste).
import mongoose from 'mongoose';
import { conectar } from '../../db.js';
import { criarServidor } from '../../server.js';

const HOST_MONGO = process.env.MONGO_TEST_HOST || 'mongodb://127.0.0.1:27019';

export async function iniciar() {
  const banco = `controle-escolas-test-${process.pid}-${Date.now()}`;
  await conectar(`${HOST_MONGO}/${banco}`);
  const server = criarServidor();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;

  // Resposta sempre em { status, corpo }, mesmo quando o corpo não é JSON.
  const req = async (metodo, caminho, corpo, { bruto = false } = {}) => {
    const r = await fetch(base + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : bruto ? corpo : JSON.stringify(corpo),
    });
    const texto = await r.text();
    let json; try { json = JSON.parse(texto); } catch { json = texto; }
    return { status: r.status, corpo: json };
  };

  return {
    req,
    async escolas() { return (await req('GET', '/api/escolas')).corpo; },
    async fechar() {
      await new Promise((ok) => server.close(ok));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    },
  };
}
