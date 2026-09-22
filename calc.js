// Cálculo financeiro puro (sem acesso a banco), para ser testável.
//
// Duas visões por mês:
//  - Competência (lucro): receita - custos, com 13º e férias PROVISIONADOS todo mês.
//  - Caixa: o que realmente entra/sai; 13º sai em nov/dez, 1/3 de férias no mês de férias.
//
// Premissa de férias: o salário do mês de férias já está na folha normal, então o
// desembolso extra é o adicional de 1/3 (+ encargos). Provisão mensal = (salário/3)/12.
//
// Lançamentos reais:
//  - Mês aberto: só os lançamentos "avulsos" (fora do orçamento) somam ao previsto;
//    os demais servem para acompanhar previsto x realizado por categoria.
//  - Mês fechado: o caixa usa somente o realizado (todos os lançamentos do mês).

const SOMAVEIS = ['receita', 'salarios', 'beneficios', 'encargos', 'prov13', 'provFerias', 'despesas', 'impostos', 'custoCompetencia', 'resultado', 'entrada', 'saida'];

// Colaborador conta na folha do mês? Sem datas, vale `ativo` o ano todo.
export function ativoNoMes(f, ano, mes) {
  if (!f.ativo && !f.data_desligamento) return false;
  if (!ano) return true;
  const ref = ano * 12 + mes;
  const ym = (s) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7));
  if (f.data_admissao && ym(f.data_admissao) > ref) return false;
  if (f.data_desligamento && ym(f.data_desligamento) < ref) return false;
  return true;
}

export function calcularEscola({ escola, funcionarios, receitas, despesas, fatores, fechados = [], lancamentos, ano }) {
  const enc = (escola.encargos_pct || 0) / 100;
  const imp = (escola.imposto_pct || 0) / 100;

  const meses = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const fator = fatores[i] ?? 1;
    const ativos = funcionarios.filter((f) => ativoNoMes(f, ano, mes));

    const receita = receitas.reduce((s, r) => s + r.valor_mensal * (r.segue_calendario ? fator : 1), 0);
    const despesasMes = despesas.reduce((s, d) => s + d.valor_mensal * (d.segue_calendario ? fator : 1), 0);
    const salarios = ativos.reduce((s, f) => s + f.salario, 0);
    const beneficios = ativos.reduce((s, f) => s + (f.beneficios || 0), 0);
    const encargos = salarios * enc;
    const prov13 = (salarios / 12) * (1 + enc);
    const provFerias = (salarios / 3 / 12) * (1 + enc);
    const impostos = receita * imp;

    // Caixa
    const pagto13 = mes === 11 || mes === 12 ? (salarios / 2) * (1 + enc) : 0;
    const pagtoFerias = ativos
      .filter((f) => (f.mes_ferias || escola.mes_ferias) === mes)
      .reduce((s, f) => s + (f.salario / 3) * (1 + enc), 0);

    // Avulsos (rescisões, compras pontuais) entram no custo do mês além do orçamento.
    const lm = lancamentos.filter((l) => Number(l.data.slice(5, 7)) === mes);
    const soma = (lista, tipo) => lista.filter((l) => l.tipo === tipo).reduce((s, l) => s + l.valor, 0);
    const avulsos = lm.filter((l) => l.avulso);
    const avulsoReceita = soma(avulsos, 'receita');
    const avulsoDespesa = soma(avulsos, 'despesa');

    const custoCompetencia = salarios + beneficios + encargos + prov13 + provFerias + despesasMes + impostos + avulsoDespesa;
    const saidaPrevista = salarios + beneficios + encargos + despesasMes + impostos + pagto13 + pagtoFerias + avulsoDespesa;
    const fechado = !!fechados[i];
    const realizado = { n: lm.length, receita: soma(lm, 'receita'), despesa: soma(lm, 'despesa') };

    return {
      mes, fator, receita: receita + avulsoReceita, salarios, beneficios, encargos, prov13, provFerias,
      despesas: despesasMes + avulsoDespesa, impostos, custoCompetencia, resultado: receita + avulsoReceita - custoCompetencia,
      pagto13, pagtoFerias, avulsoDespesa, avulsoReceita, realizado, fechado,
      entrada: fechado ? realizado.receita : receita + avulsoReceita,
      saida: fechado ? realizado.despesa : saidaPrevista,
    };
  });

  // Previsto x realizado por categoria de despesa (ano todo).
  const cats = new Map();
  const cat = (nome) => cats.get(nome) ?? cats.set(nome, { categoria: nome, previsto: 0, realizado: 0 }).get(nome);
  for (const d of despesas) {
    cat(d.categoria || 'Outros').previsto += fatores.reduce((s, f) => s + d.valor_mensal * (d.segue_calendario ? f : 1), 0);
  }
  for (const l of lancamentos.filter((x) => x.tipo === 'despesa')) cat(l.categoria || 'Outros').realizado += l.valor;

  return { ...fecharCaixa(meses, escola.saldo_inicial || 0), categorias: [...cats.values()] };
}

export function fecharCaixa(meses, saldoInicial) {
  let saldo = saldoInicial;
  for (const m of meses) {
    saldo += m.entrada - m.saida;
    m.saldo = saldo;
  }
  const totais = {};
  for (const k of SOMAVEIS) totais[k] = meses.reduce((s, m) => s + m[k], 0);
  const saldos = meses.map((m) => m.saldo);
  const minSaldo = Math.min(...saldos);
  return {
    meses,
    totais,
    saldoInicial,
    saldoFinal: saldo,
    minSaldo,
    mesMinSaldo: saldos.indexOf(minSaldo) + 1,
    // Dinheiro que faltaria em caixa no pior mês (0 se o caixa nunca fica negativo).
    reservaNecessaria: Math.max(0, -minSaldo),
    margem: totais.receita ? totais.resultado / totais.receita : 0,
  };
}

export function consolidar(resultados, saldoInicialTotal) {
  const meses = Array.from({ length: 12 }, (_, i) => {
    const soma = { mes: i + 1, fechado: true, realizado: { n: 0, receita: 0, despesa: 0 } };
    for (const r of resultados) {
      const m = r.meses[i];
      for (const k of Object.keys(m)) if (typeof m[k] === 'number' && !['mes', 'fator', 'saldo'].includes(k)) soma[k] = (soma[k] || 0) + m[k];
      soma.fechado &&= m.fechado;
      for (const k of ['n', 'receita', 'despesa']) soma.realizado[k] += m.realizado[k];
    }
    soma.fator = resultados.length ? resultados.reduce((s, r) => s + r.meses[i].fator, 0) / resultados.length : 1;
    return soma;
  });
  const cats = new Map();
  for (const r of resultados) for (const c of r.categorias) {
    const x = cats.get(c.categoria) ?? cats.set(c.categoria, { categoria: c.categoria, previsto: 0, realizado: 0 }).get(c.categoria);
    x.previsto += c.previsto; x.realizado += c.realizado;
  }
  return { ...fecharCaixa(meses, saldoInicialTotal), categorias: [...cats.values()] };
}
