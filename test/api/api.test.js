import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar } from './helpers.js';

let api, novoMundo, cic;
const perto = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `esperava ${b}, veio ${a}`);

before(async () => {
  api = await iniciar();
  [novoMundo, cic] = await api.escolas();
});
after(() => api.fechar());

test('AC1: relatório consolidado devolve 12 meses e respeita o repasse da Prefeitura', async () => {
  await api.req('POST', '/api/receitas', { escola_id: novoMundo.id, descricao: 'Contrato Prefeitura', valor_mensal: 60000, segue_calendario: 1 });
  const r = await api.req('GET', '/api/relatorio?ano=2026&escola=todas');
  assert.equal(r.status, 200);
  assert.equal(r.corpo.meses.length, 12);
  assert.ok(r.corpo.totais.receita > 0);
  assert.equal(r.corpo.meses[0].receita, 0, 'janeiro: Prefeitura não paga');
  assert.equal(r.corpo.meses[1].receita, 30000, 'fevereiro: metade');
  assert.equal(r.corpo.meses[2].receita, 60000);
  assert.equal(r.corpo.meses[6].receita, 0, 'julho: Prefeitura não paga');
});

test('AC2 e AC3: dividir por crianças cria dois lançamentos ligados e a exclusão do grupo remove os dois', async () => {
  await api.req('PUT', `/api/escolas/${novoMundo.id}`, { criancas: 62 });
  await api.req('PUT', `/api/escolas/${cic.id}`, { criancas: 48 });
  const d = await api.req('POST', '/api/dividir', {
    recurso: 'lancamentos', modo: 'criancas',
    dados: { data: '2026-03-12', tipo: 'despesa', categoria: 'Material de cozinha', descricao: 'Panelas', valor: 1850, avulso: 1 },
  });
  assert.equal(d.status, 201);
  const [a, b] = d.corpo.partes;
  perto(a.valor + b.valor, 1850);
  assert.equal(a.valor, 1042.73);
  assert.equal(b.valor, 807.27);

  const nm = (await api.req('GET', `/api/lancamentos?escola_id=${novoMundo.id}&ano=2026`)).corpo;
  const ci = (await api.req('GET', `/api/lancamentos?escola_id=${cic.id}&ano=2026`)).corpo;
  assert.equal(nm.length, 1);
  assert.equal(ci.length, 1);
  assert.equal(nm[0].grupo_id, ci[0].grupo_id);
  assert.equal(nm[0].valor_total, 1850);

  const del = await api.req('DELETE', `/api/lancamentos/${nm[0].id}?grupo=1`);
  assert.equal(del.corpo.removidos, 2);
  assert.equal((await api.req('GET', `/api/lancamentos?escola_id=${cic.id}&ano=2026`)).corpo.length, 0);
});

test('AC4 e AC5: rescisão bate com a conta à mão e efetivar desliga e lança o custo', async () => {
  const f = (await api.req('POST', '/api/funcionarios', {
    escola_id: cic.id, nome: 'Teste Silva', salario: 3000, data_admissao: '2023-03-10', ferias_periodos_gozados: 3,
  })).corpo;
  const q = `funcionario_id=${f.id}&data=2026-09-18&tipo=sem_justa_causa`;

  const r = await api.req('GET', `/api/rescisao?${q}`);
  assert.equal(r.status, 200);
  perto(r.corpo.totalColaborador, 10866.67);
  perto(r.corpo.custoEscola, 16153.07);

  const antes = (await api.req('GET', `/api/relatorio?ano=2026&escola=${cic.id}`)).corpo.meses[8].saida;
  const ef = await api.req('POST', '/api/rescisao', { funcionario_id: f.id, data: '2026-09-18', tipo: 'sem_justa_causa', aviso: 'indenizado', aviso_cumprido: '1' });
  assert.equal(ef.status, 201);

  const func = (await api.req('GET', `/api/funcionarios?escola_id=${cic.id}`)).corpo.find((x) => x.id === f.id);
  assert.equal(func.ativo, 0);
  assert.equal(func.data_desligamento, '2026-09-18');

  const lanc = (await api.req('GET', `/api/lancamentos?escola_id=${cic.id}&ano=2026`)).corpo;
  assert.equal(lanc.length, 1);
  assert.equal(lanc[0].categoria, 'Rescisão');
  assert.equal(lanc[0].avulso, 1);
  perto(lanc[0].valor, 16153.07);

  const depois = (await api.req('GET', `/api/relatorio?ano=2026&escola=${cic.id}`)).corpo.meses[8].saida;
  perto(depois - antes, 16153.07); // o salário de setembro continua; só a rescisão soma
});

test('AC7: entrada inválida devolve 4xx com mensagem, nunca 500', async () => {
  const sem = (await api.req('POST', '/api/funcionarios', { escola_id: novoMundo.id, nome: 'Com admissão', salario: 2000, data_admissao: '2024-01-10' })).corpo;
  const semAdmissao = (await api.req('POST', '/api/funcionarios', { escola_id: novoMundo.id, nome: 'Sem admissão', salario: 2000 })).corpo;
  const casos = [
    ['ano não numérico', () => api.req('GET', '/api/relatorio?ano=abc&escola=todas'), 400],
    ['ano fora da faixa', () => api.req('GET', '/api/relatorio?ano=1800&escola=todas'), 400],
    ['escola inválida', () => api.req('GET', '/api/relatorio?ano=2026&escola=xyz'), 400],
    ['id malformado no PUT', () => api.req('PUT', '/api/funcionarios/xyz', { nome: 'x' }), 400],
    ['id malformado no DELETE', () => api.req('DELETE', '/api/receitas/123'), 400],
    ['JSON quebrado', () => api.req('POST', '/api/receitas', '{nao e json', { bruto: true }), 400],
    ['corpo que não é objeto', () => api.req('POST', '/api/receitas', '[1,2]', { bruto: true }), 400],
    ['número onde deveria ser texto/valor', () => api.req('POST', '/api/receitas', { escola_id: novoMundo.id, descricao: 'x', valor_mensal: 'abc' }), 400],
    ['mês 13 no calendário', () => api.req('PUT', `/api/calendario?escola_id=${novoMundo.id}&ano=2026`, { mes: 13, fator: 1 }), 400],
    ['fator acima de 1', () => api.req('PUT', `/api/calendario?escola_id=${novoMundo.id}&ano=2026`, { mes: 3, fator: 5 }), 400],
    ['rescisão de colaborador inexistente', () => api.req('GET', `/api/rescisao?funcionario_id=${'a'.repeat(24)}&data=2026-09-18&tipo=acordo`), 404],
    ['rescisão com data inválida', () => api.req('GET', `/api/rescisao?funcionario_id=${sem.id}&data=hoje&tipo=acordo`), 400],
    ['rescisão antes da admissão', () => api.req('GET', `/api/rescisao?funcionario_id=${sem.id}&data=2020-01-01&tipo=acordo`), 400],
    ['rescisão com motivo inválido', () => api.req('GET', `/api/rescisao?funcionario_id=${sem.id}&data=2026-09-18&tipo=inventado`), 400],
    ['rescisão de colaborador sem admissão', () => api.req('GET', `/api/rescisao?funcionario_id=${semAdmissao.id}&data=2026-09-18&tipo=acordo`), 400],
    ['divisão manual que não soma 100', () => api.req('POST', '/api/dividir', { recurso: 'lancamentos', modo: 'manual', pcts: { [novoMundo.id]: 70, [cic.id]: 20 }, dados: { data: '2026-01-01', tipo: 'despesa', valor: 100 } }), 400],
    ['divisão de recurso não permitido', () => api.req('POST', '/api/dividir', { recurso: 'escolas', modo: 'igual', dados: { valor: 1 } }), 400],
    ['despesa sem descrição', () => api.req('POST', '/api/despesas', { escola_id: novoMundo.id, valor_mensal: 10 }), 400],
    ['recurso inexistente', () => api.req('GET', '/api/naoexiste'), 404],
    ['excluir escola', () => api.req('DELETE', `/api/escolas/${novoMundo.id}`), 400],
    ['corpo gigante', () => api.req('POST', '/api/receitas', { escola_id: novoMundo.id, descricao: 'x'.repeat(1.2 * 1024 * 1024) }), 413],
  ];
  for (const [nome, executar, esperado] of casos) {
    const r = await executar();
    assert.equal(r.status, esperado, `${nome}: esperava ${esperado}, veio ${r.status} ${JSON.stringify(r.corpo).slice(0, 120)}`);
    assert.ok(r.corpo.erro, `${nome}: deve trazer mensagem de erro`);
    assert.ok(!/Path `|validation failed|Cast to/i.test(r.corpo.erro), `${nome}: mensagem técnica vazou: ${r.corpo.erro}`);
  }
  const semDescricao = await api.req('POST', '/api/despesas', { escola_id: novoMundo.id, valor_mensal: 10 });
  assert.equal(semDescricao.corpo.erro, 'Preencha o campo "descrição".');
});

test('AC7: caminho com ".." não devolve arquivos fora de public/', async () => {
  for (const caminho of ['/../server.js', '/..%2fserver.js', '/%2e%2e/db.js']) {
    const r = await api.req('GET', caminho);
    assert.ok(r.status >= 400 && r.status < 500, `${caminho} devolveu ${r.status}`);
    assert.ok(!String(r.corpo).includes('mongoose'), `${caminho} vazou código-fonte`);
  }
});
