import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { conectar, garantirCalendario, Calendario, Escola, Funcionario, Receita, Despesa, Lancamento } from './db.js';
import { calcularEscola, consolidar } from './calc.js';
import { calcularRescisao, TIPOS_RESCISAO } from './rescisao.js';
import { ratear } from './rateio.js';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { ErroEntrada, mensagemDeValidacao } from './erros.js';

const PORT = Number(process.env.PORT) || 3200;
const HOST = process.env.LISTEN_HOST || '127.0.0.1'; // só este computador, até existir login (Loop 8)
const MAX_CORPO = 1024 * 1024;
const PUBLIC = new URL('./public', import.meta.url).pathname;

// Recursos com CRUD genérico. `cols` é a lista branca de campos graváveis.
const RECURSOS = {
  funcionarios: { model: Funcionario, cols: ['escola_id', 'nome', 'cargo', 'cpf', 'salario', 'beneficios', 'data_admissao', 'data_desligamento', 'ferias_periodos_gozados', 'fgts_saldo', 'mes_ferias', 'ativo'] },
  receitas: { model: Receita, cols: ['escola_id', 'descricao', 'valor_mensal', 'segue_calendario'] },
  despesas: { model: Despesa, cols: ['escola_id', 'descricao', 'categoria', 'valor_mensal', 'segue_calendario'] },
  lancamentos: { model: Lancamento, cols: ['escola_id', 'data', 'tipo', 'categoria', 'descricao', 'valor', 'avulso'] },
  escolas: { model: Escola, cols: ['nome', 'encargos_pct', 'imposto_pct', 'saldo_inicial', 'mes_ferias', 'criancas'] },
};

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

const lerCorpo = (req) => new Promise((resolve, reject) => {
  let raw = '';
  let estourou = false;
  req.on('data', (c) => {
    if (estourou) return; // continua drenando o corpo para poder responder 413
    raw += c;
    if (raw.length > MAX_CORPO) { estourou = true; raw = ''; reject(new ErroEntrada('corpo da requisição grande demais', 413)); }
  });
  req.on('end', () => {
    if (estourou) return;
    if (!raw) return resolve({});
    try {
      const corpo = JSON.parse(raw);
      if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) throw new Error();
      resolve(corpo);
    } catch { reject(new ErroEntrada('corpo da requisição não é um JSON de objeto válido')); }
  });
});

// Validações de parâmetros de rota/consulta.
const exigirId = (v, nome = 'id') => {
  if (!mongoose.isValidObjectId(v) || String(v).length !== 24) throw new ErroEntrada(`${nome} inválido`);
  return v;
};
const exigirAno = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new ErroEntrada('ano inválido (use um ano entre 2000 e 2100)');
  return n;
};

function limpar(cols, body) {
  const out = {};
  for (const c of cols) if (c in body) out[c] = body[c] === '' ? null : body[c];
  return out;
}

async function relatorio(ano, escolaParam) {
  if (escolaParam !== 'todas') exigirId(escolaParam, 'escola');
  const escolas = await (escolaParam === 'todas' ? Escola.find().sort('_id') : Escola.find({ _id: escolaParam })).lean();
  const resultados = await Promise.all(escolas.map(async (escola) => {
    await garantirCalendario(escola._id, ano);
    const [funcionarios, receitas, despesas, cal, lancamentos] = await Promise.all([
      Funcionario.find({ escola_id: escola._id }).lean(),
      Receita.find({ escola_id: escola._id }).lean(),
      Despesa.find({ escola_id: escola._id }).lean(),
      Calendario.find({ escola_id: escola._id, ano }).sort('mes').lean(),
      Lancamento.find({ escola_id: escola._id, data: { $regex: `^${ano}-` } }).lean(),
    ]);
    return calcularEscola({ escola, funcionarios, receitas, despesas, fatores: cal.map((c) => c.fator), fechados: cal.map((c) => c.fechado), lancamentos, ano });
  }));
  if (escolaParam !== 'todas') return resultados[0];
  return { ...consolidar(resultados, escolas.reduce((s, e) => s + e.saldo_inicial, 0)), porEscola: escolas.map((e, i) => ({ id: String(e._id), nome: e.nome, ...resultados[i].totais })) };
}

// Cria uma despesa/lançamento por escola, com o valor dividido, ligados por `grupo_id`.
async function dividir({ recurso, dados, modo, pcts }) {
  const def = RECURSOS[recurso];
  if (!def || !['despesas', 'lancamentos'].includes(recurso)) throw new ErroEntrada('só despesas e lançamentos podem ser divididos');
  if (!dados || typeof dados !== 'object') throw new ErroEntrada('dados da divisão ausentes');
  const campoValor = recurso === 'despesas' ? 'valor_mensal' : 'valor';
  const escolas = (await Escola.find().sort('_id').lean()).map((e) => ({ id: String(e._id), criancas: e.criancas }));
  const partes = ratear(Number(dados[campoValor]), escolas, modo, pcts);
  const grupo_id = randomUUID();
  const base = limpar(def.cols, dados);
  const docs = await def.model.create(partes.filter((p) => p.valor > 0).map((p) => ({
    ...base, escola_id: p.escola_id, [campoValor]: p.valor, grupo_id, valor_total: Number(dados[campoValor]), rateio_pct: p.pct,
  })));
  return { grupo_id, partes, ids: docs.map((d) => String(d._id)) };
}

async function dadosRescisao(q) {
  const f = await Funcionario.findById(exigirId(q.get('funcionario_id'), 'funcionario_id')).lean();
  if (!f) throw new ErroEntrada('colaborador não encontrado', 404);
  if (!f.data_admissao) throw new ErroEntrada('cadastre a data de admissão do colaborador');
  return { f, entrada: {
    salario: f.salario, data_admissao: f.data_admissao, data_rescisao: q.get('data'), tipo: q.get('tipo'),
    aviso: q.get('aviso') || 'indenizado', aviso_cumprido: q.get('aviso_cumprido') !== '0',
    ferias_periodos_gozados: f.ferias_periodos_gozados || 0, fgts_saldo: f.fgts_saldo,
  } };
}

async function simularRescisao(q) {
  const { f, entrada } = await dadosRescisao(q);
  return { colaborador: { id: String(f._id), nome: f.nome }, ...calcularRescisao(entrada) };
}

// Desliga o colaborador e lança o custo da rescisão como despesa avulsa no mês.
async function efetivarRescisao(body) {
  const q = new URLSearchParams(body);
  const { f, entrada } = await dadosRescisao(q);
  const r = calcularRescisao(entrada);
  await Funcionario.updateOne({ _id: f._id }, { $set: { ativo: 0, data_desligamento: entrada.data_rescisao } });
  await Lancamento.create({
    escola_id: f.escola_id, data: entrada.data_rescisao, tipo: 'despesa', categoria: 'Rescisão', avulso: 1,
    descricao: `${TIPOS_RESCISAO[entrada.tipo]} — ${f.nome}`, valor: r.custoEscola,
  });
  return { ok: true, custoEscola: r.custoEscola };
}

async function api(req, res, url) {
  const [recurso, id] = url.pathname.split('/').filter(Boolean).slice(1);
  if (id !== undefined) exigirId(id);
  const q = url.searchParams;

  if (recurso === 'relatorio') return json(res, 200, await relatorio(exigirAno(q.get('ano') ?? new Date().getFullYear()), q.get('escola') || 'todas'));

  if (recurso === 'calendario') {
    const escolaId = exigirId(q.get('escola_id'), 'escola_id');
    const ano = exigirAno(q.get('ano'));
    if (req.method === 'PUT') {
      const { mes, fator, fechado } = await lerCorpo(req);
      if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new ErroEntrada('mes deve ser um inteiro de 1 a 12');
      if (fator !== undefined && !(Number(fator) >= 0 && Number(fator) <= 1)) throw new ErroEntrada('fator deve estar entre 0 e 1');
      const set = {};
      if (fator !== undefined) set.fator = Math.min(1, Math.max(0, Number(fator)));
      if (fechado !== undefined) set.fechado = !!fechado;
      await Calendario.updateOne({ escola_id: escolaId, ano, mes }, { $set: set });
      return json(res, 200, { ok: true });
    }
    await garantirCalendario(escolaId, ano);
    return json(res, 200, await Calendario.find({ escola_id: escolaId, ano }).sort('mes').select('mes fator fechado -_id').lean());
  }

  if (recurso === 'dividir' && req.method === 'POST') return json(res, 201, await dividir(await lerCorpo(req)));

  if (recurso === 'rescisao') {
    if (req.method === 'GET') return json(res, 200, await simularRescisao(q));
    if (req.method === 'POST') return json(res, 201, await efetivarRescisao(await lerCorpo(req)));
  }

  const def = RECURSOS[recurso];
  if (!def) return json(res, 404, { erro: 'recurso não encontrado' });
  const { model, cols } = def;

  if (req.method === 'GET') {
    const filtro = {};
    if (recurso !== 'escolas' && q.get('escola_id')) filtro.escola_id = exigirId(q.get('escola_id'), 'escola_id');
    if (recurso === 'lancamentos' && q.get('ano')) filtro.data = { $regex: `^${exigirAno(q.get('ano'))}-` };
    const ordem = recurso === 'lancamentos' ? { data: -1, _id: -1 } : { _id: 1 };
    return json(res, 200, await model.find(filtro).sort(ordem));
  }
  if (req.method === 'POST') {
    const doc = await model.create(limpar(cols, await lerCorpo(req)));
    return json(res, 201, { id: String(doc._id) });
  }
  if (req.method === 'PUT' && id) {
    await model.updateOne({ _id: id }, { $set: limpar(cols, await lerCorpo(req)) }, { runValidators: true });
    return json(res, 200, { ok: true });
  }
  if (req.method === 'DELETE' && id) {
    if (recurso === 'escolas') return json(res, 400, { erro: 'não é possível excluir escolas' });
    if (q.get('grupo')) {
      const doc = await model.findById(id);
      if (doc?.grupo_id) return json(res, 200, { ok: true, removidos: (await model.deleteMany({ grupo_id: doc.grupo_id })).deletedCount });
    }
    await model.deleteOne({ _id: id });
    return json(res, 200, { ok: true });
  }
  json(res, 405, { erro: 'método não suportado' });
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

export function criarServidor() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
      const arquivo = join(PUBLIC, rel);
      if (rel.includes('..') || !arquivo.startsWith(PUBLIC)) return json(res, 400, { erro: 'caminho inválido' });
      const buf = await readFile(arquivo);
      res.writeHead(200, { 'Content-Type': TIPOS[extname(rel)] || 'application/octet-stream' });
      res.end(buf);
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'EISDIR') return json(res, 404, { erro: 'não encontrado' });
      const entrada = e instanceof ErroEntrada || e.name === 'ValidationError' || e.name === 'CastError';
      if (!entrada) console.error(e);
      json(res, e.status ?? (entrada ? 400 : 500), { erro: entrada ? mensagemDeValidacao(e) : 'erro interno' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await conectar();
  criarServidor().listen(PORT, HOST, () => console.log(`Controle das Escolas em http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}`));
}
