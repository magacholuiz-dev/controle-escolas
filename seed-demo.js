// Popula um banco de demonstração com dados fictícios. Só roda se o banco não tiver receitas.
import mongoose from 'mongoose';
import { conectar, Escola, Receita, Funcionario, Despesa, Lancamento } from './db.js';
import { ratear } from './rateio.js';
import { randomUUID } from 'node:crypto';

await conectar();
if ((await Receita.countDocuments()) === 0) {
  const escolas = await Escola.find().sort('_id'); // Novo Mundo, CIC
  const ano = new Date().getFullYear();
  await Escola.updateOne({ _id: escolas[0]._id }, { criancas: 62, saldo_inicial: 15000 });
  await Escola.updateOne({ _id: escolas[1]._id }, { criancas: 48 });

  for (const [e, base, aux] of [[escolas[0], 60000, 8], [escolas[1], 42000, 5]]) {
    const escola_id = e._id;
    await Receita.create([
      { escola_id, descricao: 'Contrato Prefeitura', valor_mensal: base, segue_calendario: 1 },
      { escola_id, descricao: 'Mensalidades particulares', valor_mensal: base / 8, segue_calendario: 0 },
    ]);
    await Funcionario.create([
      { escola_id, nome: 'Professora regente', cargo: 'Professora', salario: 3200, beneficios: 600, data_admissao: '2021-02-01', ferias_periodos_gozados: 4 },
      ...Array.from({ length: aux }, (_, i) => ({ escola_id, nome: `Auxiliar ${i + 1}`, cargo: 'Auxiliar', salario: 2300, beneficios: 500, data_admissao: `${2022 + (i % 3)}-0${1 + (i % 9)}-15`, ferias_periodos_gozados: i % 3 })),
    ]);
    await Despesa.create([
      { escola_id, descricao: 'Alimentação', categoria: 'Alimentação', valor_mensal: base * 0.15, segue_calendario: 1 },
      { escola_id, descricao: 'Aluguel', categoria: 'Aluguel', valor_mensal: base * 0.11 },
      { escola_id, descricao: 'Água', categoria: 'Água', valor_mensal: base * 0.012 },
      { escola_id, descricao: 'Luz', categoria: 'Luz', valor_mensal: base * 0.02 },
      { escola_id, descricao: 'Internet', categoria: 'Internet', valor_mensal: 250 },
      { escola_id, descricao: 'Segurança / alarme', categoria: 'Segurança', valor_mensal: 480 },
    ]);
    await Lancamento.create({ escola_id, data: `${ano}-03-08`, tipo: 'despesa', categoria: 'Luz', descricao: 'Conta de março', valor: base * 0.022 });
  }

  // Compra de utensílios dividida proporcionalmente às crianças
  const partes = ratear(1850, escolas.map((e, i) => ({ id: String(e._id), criancas: [62, 48][i] })), 'criancas');
  const grupo_id = randomUUID();
  await Lancamento.create(partes.map((p) => ({
    escola_id: p.escola_id, data: `${ano}-03-12`, tipo: 'despesa', categoria: 'Material de cozinha', avulso: 1,
    descricao: 'Panelas e utensílios de cozinha', valor: p.valor, grupo_id, valor_total: 1850, rateio_pct: p.pct,
  })));
}
await mongoose.disconnect();
