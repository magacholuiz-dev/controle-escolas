const $ = (s) => document.querySelector(s);
// Toda falha de chamada à API (cadastro, edição, exclusão) aparece para a pessoa em vez de sumir.
window.addEventListener('unhandledrejection', (e) => { alert(e.reason?.message || 'Algo deu errado.'); render?.(); });
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const brl = (n) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (n) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (n) => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const cls = (n) => (n < -0.005 ? 'neg' : n > 0.005 ? 'pos' : '');

const api = async (method, url, body) => {
  const r = await fetch('/api/' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error((await r.json()).erro || r.statusText);
  return r.json();
};

const estado = { escolas: [], escola: 'todas', ano: new Date().getFullYear(), aba: 'painel' };
const ABAS = [
  ['painel', 'Painel'], ['receitas', 'Receitas'], ['equipe', 'Equipe'], ['despesas', 'Despesas'],
  ['repasse', 'Calendário de repasse'], ['lancamentos', 'Lançamentos reais'], ['params', 'Parâmetros'],
];

// ---------- CRUD genérico com edição na própria linha ----------
function campo(f, valor, onChange) {
  let el;
  if (f.tipo === 'select') {
    el = document.createElement('select');
    for (const [v, t] of f.opcoes) el.add(new Option(t, v));
    el.value = valor ?? f.opcoes[0][0];
  } else if (f.tipo === 'bool') {
    el = document.createElement('input'); el.type = 'checkbox'; el.checked = !!valor;
  } else {
    el = document.createElement('input');
    el.type = f.tipo === 'money' || f.tipo === 'num' ? 'number' : f.tipo === 'date' ? 'date' : 'text';
    if (el.type === 'number') el.step = '0.01';
    el.value = valor ?? '';
  }
  if (onChange) el.addEventListener('change', () => onChange(lerCampo(f, el)));
  return el;
}
const lerCampo = (f, el) => (f.tipo === 'bool' ? (el.checked ? 1 : 0) : f.tipo === 'money' || f.tipo === 'num' ? (el.value === '' ? null : Number(el.value)) : el.value);

async function crud(root, recurso, campos, { extra = {}, query = '', padrao = {}, totalCampo, acoes } = {}) {
  const dados = await api('GET', `${recurso}?${query}`);
  const tab = document.createElement('div'); tab.className = 'card edit';
  const t = document.createElement('table');
  t.innerHTML = `<tr>${campos.map((f) => `<th>${f.rotulo}</th>`).join('')}<th></th></tr>`;
  for (const linha of dados) {
    const tr = t.insertRow();
    for (const f of campos) {
      tr.insertCell().append(campo(f, linha[f.chave], (v) => api('PUT', `${recurso}/${linha.id}`, { [f.chave]: v }).then(render)));
    }
    const cel = tr.insertCell(); cel.className = 'acoes';
    if (acoes) acoes(linha, cel);
    if (linha.grupo_id) cel.insertAdjacentHTML('beforeend', `<span class="chip" title="Compra dividida entre as escolas. Total ${brl(linha.valor_total)}">dividido ${pct(linha.rateio_pct / 100)}</span>`);
    const b = document.createElement('button'); b.textContent = 'Excluir'; b.className = 'sec';
    b.onclick = async () => {
      const grupo = !!linha.grupo_id;
      if (!confirm(grupo ? 'Este item foi dividido entre as escolas. Excluir a divisão inteira (nas duas escolas)?' : 'Excluir este item?')) return;
      await api('DELETE', `${recurso}/${linha.id}${grupo ? '?grupo=1' : ''}`); render();
    };
    cel.append(b);
  }
  if (totalCampo) {
    const tr = t.insertRow(); tr.className = 'tot';
    tr.insertCell().textContent = 'Total';
    campos.slice(1).forEach((f) => { tr.insertCell().textContent = f.chave === totalCampo ? brl(dados.reduce((s, l) => s + (l[totalCampo] || 0) * (l.ativo === 0 ? 0 : 1), 0)) : ''; });
    tr.insertCell();
  }
  tab.append(t); root.append(tab);

  const form = document.createElement('div'); form.className = 'add';
  const novos = {};
  for (const f of campos) {
    const lab = document.createElement('label'); lab.append(f.rotulo);
    const el = campo(f, padrao[f.chave], (v) => (novos[f.chave] = v));
    novos[f.chave] = lerCampo(f, el);
    lab.append(el); form.append(lab);
  }
  const add = document.createElement('button'); add.textContent = 'Adicionar';
  add.onclick = async () => { await api('POST', recurso, { ...novos, ...extra }); render(); };
  form.append(add); root.append(form);
}

const escolaAlvo = () => (estado.escola === 'todas' ? estado.escolas[0].id : estado.escola);
const nomeEscola = () => estado.escolas.find((e) => e.id === escolaAlvo()).nome;
const CATEGORIAS = ['Alimentação', 'Aluguel', 'Água', 'Luz', 'Internet', 'Segurança', 'Material de cozinha', 'Material de limpeza', 'Material pedagógico', 'Manutenção', 'Contabilidade', 'Rescisão', 'Outros'];
const OPC_CAT = CATEGORIAS.map((c) => [c, c]);

// Formulário para dividir uma despesa/lançamento entre as escolas (rateio).
function formDividir(root, recurso, { padrao = {}, campos }) {
  const [e1, e2] = estado.escolas;
  const c = document.createElement('section'); c.className = 'card';
  c.innerHTML = `<h2>Dividir entre as escolas</h2><div class="sub">Um único valor (ex.: compra de panelas e produtos de limpeza) vira um lançamento em cada escola, cada um com a sua parte.</div>`;
  const form = document.createElement('div'); form.className = 'add';
  const dados = { ...padrao }; let modo = 'igual', pctE1 = 50;
  for (const f of campos) {
    const lab = document.createElement('label'); lab.append(f.rotulo);
    const el = campo(f, padrao[f.chave], (v) => { dados[f.chave] = v; previa(); });
    dados[f.chave] = lerCampo(f, el); lab.append(el); form.append(lab);
  }
  const labModo = document.createElement('label'); labModo.append('Como dividir');
  const selModo = campo({ tipo: 'select', opcoes: [['igual', 'Igual (50/50)'], ['criancas', 'Proporcional às crianças'], ['manual', 'Percentual manual']] }, 'igual', (v) => { modo = v; labPct.hidden = v !== 'manual'; previa(); });
  labModo.append(selModo); form.append(labModo);
  const labPct = document.createElement('label'); labPct.hidden = true; labPct.append(`% para ${e1.nome}`);
  const inPct = campo({ tipo: 'num' }, 50, (v) => { pctE1 = v; previa(); }); labPct.append(inPct); form.append(labPct);
  const prev = document.createElement('div'); prev.className = 'nota'; prev.style.width = '100%';
  const chave = recurso === 'despesas' ? 'valor_mensal' : 'valor';
  function previa() {
    const total = Number(dados[chave]) || 0;
    const p1 = modo === 'igual' ? 50 : modo === 'manual' ? pctE1 : (e1.criancas / ((e1.criancas + e2.criancas) || 1)) * 100;
    prev.textContent = total ? `${e1.nome}: ${brl(total * p1 / 100)} (${pct(p1 / 100)}) · ${e2.nome}: ${brl(total * (100 - p1) / 100)} (${pct((100 - p1) / 100)})` : '';
  }
  const b = document.createElement('button'); b.textContent = 'Dividir e lançar';
  b.onclick = async () => {
    try {
      await api('POST', 'dividir', { recurso, dados, modo, pcts: { [e1.id]: pctE1, [e2.id]: 100 - pctE1 } });
      render();
    } catch (e) { alert(e.message); }
  };
  form.append(b); c.append(form, prev); root.append(c);
}

const OPC_MES = [['', 'padrão da escola'], ...MESES.map((m, i) => [i + 1, m])];

// ---------- Abas ----------
const abas = {
  async painel(root) {
    const r = await api('GET', `relatorio?ano=${estado.ano}&escola=${estado.escola}`);
    const T = r.totais;
    const kpi = (t, v, sub, c = '') => `<div class="card kpi"><div class="t">${t}</div><div class="v ${c}">${v}</div><div class="s">${sub}</div></div>`;
    const negativo = r.reservaNecessaria > 0;
    const secos = r.meses.filter((m) => m.fator < 1).map((m) => MESES[m.mes - 1]);
    root.innerHTML = `
      <div class="top">
        <div class="card hero">
          <div class="rot">Lucro do ano ${estado.ano} (competência, já descontadas as provisões)</div>
          <div class="v ${cls(T.resultado)}">${brl0(T.resultado)}</div>
          <div class="sub">Margem de ${pct(r.margem)} · receita ${brl0(T.receita)} − custos ${brl0(T.custoCompetencia)}</div>
        </div>
        <div class="card estado ${negativo ? 'ruim' : 'bom'}">
          <div class="ic" aria-hidden="true">${negativo ? '!' : '✓'}</div>
          <div>
            <b>${negativo ? 'Caixa fica negativo' : 'Caixa positivo o ano todo'}</b>
            <p>${negativo
              ? `Pior momento em <b>${MESES[r.mesMinSaldo - 1]}</b> (${brl0(r.minSaldo)}). É preciso ter <b>${brl0(r.reservaNecessaria)}</b> guardados a mais até lá para pagar salários nos meses sem repasse.`
              : `Menor saldo: ${brl0(r.minSaldo)} em ${MESES[r.mesMinSaldo - 1]}.`}</p>
            ${secos.length ? `<p class="sub">Meses com repasse reduzido: ${secos.join(', ')}.</p>` : ''}
          </div>
        </div>
      </div>
      <div class="kpis">
        ${kpi('Receita do ano', brl0(T.receita), 'prevista, ou realizada nos meses com lançamento')}
        ${kpi('Custos do ano', brl0(T.custoCompetencia), 'folha, encargos, 13º, férias, impostos e despesas')}
        ${kpi('Provisão de 13º + férias', brl0(T.prov13 + T.provFerias), 'reserve todo mês, sai do caixa em nov/dez e nas férias')}
        ${kpi('Saldo de caixa em dezembro', brl0(r.saldoFinal), 'partindo de ' + brl0(r.saldoInicial), cls(r.saldoFinal))}
      </div>`;
    root.append(cartao('Entradas e saídas por mês', 'Caixa: o que entra e o que sai de fato em cada mês', [['Entradas', 's1'], ['Saídas', 's2']], graficoBarras(r.meses)));
    root.append(cartao('Saldo de caixa acumulado', 'Quanto dinheiro sobra (ou falta) no fim de cada mês', [['Saldo', 's3', true]], graficoSaldo(r.meses)));

    const linhas = [
      ['g', 'Competência (lucro)'],
      ['Receita', 'receita'],
      ['(−) Salários e benefícios', (m) => m.salarios + m.beneficios],
      ['(−) Encargos', 'encargos'],
      ['(−) Provisão de 13º', 'prov13'],
      ['(−) Provisão de férias', 'provFerias'],
      ['(−) Despesas (alimentação etc.)', 'despesas'],
      ['(−) Impostos', 'impostos'],
      ['Lucro do mês', 'resultado', true],
      ['g', 'Caixa'],
      ['Entradas', 'entrada'],
      ['Saídas', 'saida'],
      ['  das quais 13º e férias', (m) => m.pagto13 + m.pagtoFerias],
      ['Saldo no fim do mês', 'saldo', true, true],
    ];
    const val = (m, k) => (typeof k === 'function' ? k(m) : m[k]);
    const t = document.createElement('table');
    t.innerHTML = `<tr><th></th>${r.meses.map((m) => `<th class="${m.fator < 1 ? 'seco' : ''}">${MESES[m.mes - 1]}${m.fator < 1 ? `<span class="tag">repasse ${pct(m.fator)}</span>` : ''}</th>`).join('')}<th>Ano</th></tr>` +
      linhas.map(([nome, k, forte, semTotal]) => {
        if (nome === 'g') return `<tr class="grupo"><td colspan="14">${k}</td></tr>`;
        const tds = r.meses.map((m) => {
          const v = val(m, k);
          const c = forte ? cls(v) : '';
          return `<td class="${c}${m.fator < 1 && nome === 'Receita' ? ' seco' : ''}">${brl(v)}</td>`;
        }).join('');
        const tot = semTotal ? '' : brl(r.meses.reduce((s, m) => s + val(m, k), 0));
        return `<tr class="${forte ? 'forte' : ''}"><td>${nome}</td>${tds}<td>${tot}</td></tr>`;
      }).join('');
    const c = cartao('Mês a mês', 'Meses em amarelo têm repasse reduzido da Prefeitura. Meses fechados usam só o realizado no caixa.', null, null);
    const w = document.createElement('div'); w.className = 'tabela'; w.append(t); c.append(w); root.append(c);

    if (r.categorias?.length) {
      const cc = cartao('Despesas por categoria', 'Previsto no orçamento x realizado nos lançamentos do ano (folha não entra aqui)', null, null);
      const tb = document.createElement('div'); tb.className = 'tabela';
      const cats = [...r.categorias].sort((a, b) => Math.max(b.previsto, b.realizado) - Math.max(a.previsto, a.realizado));
      tb.innerHTML = `<table><tr><th>Categoria</th><th>Previsto</th><th>Realizado</th><th>Diferença</th></tr>${cats.map((c) => {
        const d = c.realizado - c.previsto;
        return `<tr><td>${c.categoria}</td><td>${brl0(c.previsto)}</td><td>${c.realizado ? brl0(c.realizado) : '—'}</td><td class="${c.realizado ? (d > 0 ? 'neg' : 'pos') : ''}">${c.realizado ? (d > 0 ? '▲ ' : '▼ ') + brl0(Math.abs(d)) : ''}</td></tr>`;
      }).join('')}</table>`;
      cc.append(tb); root.append(cc);
    }
    if (r.porEscola) {
      const p = cartao('Por escola', 'Resultado do ano por competência', null, null);
      const tb = document.createElement('div'); tb.className = 'tabela';
      tb.innerHTML = `<table><tr><th>Escola</th><th>Receita</th><th>Custos</th><th>Lucro</th></tr>${r.porEscola.map((e) => `<tr><td>${e.nome}</td><td>${brl(e.receita)}</td><td>${brl(e.custoCompetencia)}</td><td class="${cls(e.resultado)}">${brl(e.resultado)}</td></tr>`).join('')}</table>`;
      p.append(tb); root.append(p);
    }
  },

  async receitas(root) {
    root.innerHTML = `<p class="nota">Receitas recorrentes de <b>${nomeEscola()}</b>. Marque "segue calendário" no contrato da Prefeitura: o valor mensal é multiplicado pelo fator de repasse de cada mês (0% em janeiro e julho, 50% em fevereiro, por padrão). Mensalidades particulares normalmente não seguem o calendário.</p>`;
    await crud(root, 'receitas', [
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'text' },
      { chave: 'valor_mensal', rotulo: 'Valor mensal cheio', tipo: 'money' },
      { chave: 'segue_calendario', rotulo: 'Segue calendário da Prefeitura', tipo: 'bool' },
    ], { extra: { escola_id: escolaAlvo() }, query: `escola_id=${escolaAlvo()}`, padrao: { segue_calendario: 1 }, totalCampo: 'valor_mensal' });
  },

  async equipe(root) {
    root.innerHTML = `<p class="nota">Equipe de <b>${nomeEscola()}</b>. Cadastre cada colaborador com a data de admissão para calcular a rescisão de cada um. Encargos, 13º e férias saem do salário (percentuais em Parâmetros). Benefícios (VT/VA) entram só na folha mensal. "Férias já gozadas" é o número de períodos aquisitivos completos que o colaborador já tirou.</p>`;
    await crud(root, 'funcionarios', [
      { chave: 'nome', rotulo: 'Nome', tipo: 'text' },
      { chave: 'cpf', rotulo: 'CPF', tipo: 'text' },
      { chave: 'cargo', rotulo: 'Cargo', tipo: 'text' },
      { chave: 'salario', rotulo: 'Salário', tipo: 'money' },
      { chave: 'beneficios', rotulo: 'Benefícios/mês', tipo: 'money' },
      { chave: 'data_admissao', rotulo: 'Admissão', tipo: 'date' },
      { chave: 'ferias_periodos_gozados', rotulo: 'Férias já gozadas (períodos)', tipo: 'num' },
      { chave: 'fgts_saldo', rotulo: 'Saldo FGTS (extrato)', tipo: 'money' },
      { chave: 'mes_ferias', rotulo: 'Mês das férias', tipo: 'select', opcoes: OPC_MES },
      { chave: 'ativo', rotulo: 'Ativo', tipo: 'bool' },
      { chave: 'data_desligamento', rotulo: 'Desligamento', tipo: 'date' },
    ], {
      extra: { escola_id: escolaAlvo() }, query: `escola_id=${escolaAlvo()}`, padrao: { ativo: 1, beneficios: 0, ferias_periodos_gozados: 0 }, totalCampo: 'salario',
      acoes: (f, cel) => {
        const b = document.createElement('button'); b.textContent = 'Rescisão';
        b.onclick = () => painelRescisao(root, f);
        cel.append(b);
      },
    });
  },

  async despesas(root) {
    root.innerHTML = `<p class="nota">Despesas mensais de <b>${nomeEscola()}</b>: água, luz, internet, segurança, alimentação, aluguel etc. Informe a média mensal; as contas reais do mês entram em Lançamentos e aparecem no comparativo previsto x realizado. "Segue calendário" serve para gastos que só existem com as crianças na escola, como alimentação.</p>`;
    const campos = [
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'text' },
      { chave: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: OPC_CAT },
      { chave: 'valor_mensal', rotulo: 'Valor mensal cheio', tipo: 'money' },
      { chave: 'segue_calendario', rotulo: 'Segue calendário', tipo: 'bool' },
    ];
    await crud(root, 'despesas', campos, { extra: { escola_id: escolaAlvo() }, query: `escola_id=${escolaAlvo()}`, padrao: { categoria: 'Alimentação' }, totalCampo: 'valor_mensal' });
    formDividir(root, 'despesas', { campos, padrao: { categoria: 'Segurança', segue_calendario: 0 } });
  },

  async repasse(root) {
    const id = escolaAlvo();
    const cal = await api('GET', `calendario?escola_id=${id}&ano=${estado.ano}`);
    root.innerHTML = `<p class="nota">Calendário de <b>${nomeEscola()}</b>, ${estado.ano}. <b>Fator de repasse</b> da Prefeitura: 1 = mês inteiro, 0,5 = metade, 0 = nada. <b>Mês fechado</b>: o caixa passa a usar só os lançamentos reais do mês (em vez do previsto). Feche o mês quando todas as contas já estiverem lançadas.</p>`;
    const t = document.createElement('table');
    t.innerHTML = `<tr><th></th>${MESES.map((m) => `<th>${m}</th>`).join('')}</tr>`;
    const tr = t.insertRow(); tr.insertCell().textContent = 'Fator de repasse';
    const tf = t.insertRow(); tf.insertCell().textContent = 'Mês fechado';
    for (const c of cal) {
      const el = document.createElement('input'); el.type = 'number'; el.step = '0.05'; el.min = 0; el.max = 1; el.value = c.fator;
      el.onchange = () => api('PUT', `calendario?escola_id=${id}&ano=${estado.ano}`, { mes: c.mes, fator: el.value });
      tr.insertCell().append(el);
      const ck = document.createElement('input'); ck.type = 'checkbox'; ck.checked = !!c.fechado;
      ck.onchange = () => api('PUT', `calendario?escola_id=${id}&ano=${estado.ano}`, { mes: c.mes, fechado: ck.checked });
      tf.insertCell().append(ck);
    }
    const w = document.createElement('div'); w.className = 'card edit'; w.append(t); root.append(w);
  },

  async lancamentos(root) {
    root.innerHTML = `<p class="nota">Lance o que realmente entrou e saiu em <b>${nomeEscola()}</b>: contas de água, luz, internet, segurança, compras. Elas alimentam o comparativo previsto x realizado no Painel. Marque <b>fora do orçamento</b> para gastos que não estavam previstos (compra pontual, rescisão): eles somam ao previsto do mês. Para fechar o mês com o realizado, use Calendário de repasse.</p>`;
    const campos = [
      { chave: 'data', rotulo: 'Data', tipo: 'date' },
      { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: [['receita', 'Receita'], ['despesa', 'Despesa']] },
      { chave: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: OPC_CAT },
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'text' },
      { chave: 'valor', rotulo: 'Valor', tipo: 'money' },
      { chave: 'avulso', rotulo: 'Fora do orçamento', tipo: 'bool' },
    ];
    const hoje = new Date().toISOString().slice(0, 10);
    await crud(root, 'lancamentos', campos, { extra: { escola_id: escolaAlvo() }, query: `escola_id=${escolaAlvo()}&ano=${estado.ano}`, padrao: { data: hoje, tipo: 'despesa', categoria: 'Luz', avulso: 0 } });
    formDividir(root, 'lancamentos', { campos: campos.filter((f) => f.chave !== 'tipo'), padrao: { data: hoje, tipo: 'despesa', categoria: 'Material de limpeza', avulso: 1 } });
  },

  async params(root) {
    root.innerHTML = '<p class="nota">Percentuais por escola. <b>Encargos</b>: FGTS 8% (Simples Nacional); se a escola não for do Simples, some INSS patronal/RAT/terceiros. <b>Imposto</b>: alíquota efetiva sobre a receita — confirme com a contabilidade. <b>Saldo inicial</b>: caixa em 1º de janeiro. <b>Crianças matriculadas</b>: usado para dividir compras proporcionalmente entre as escolas.</p>';
    const escolas = await api('GET', 'escolas');
    const campos = [
      { chave: 'nome', rotulo: 'Nome', tipo: 'text' },
      { chave: 'encargos_pct', rotulo: 'Encargos sobre folha (%)', tipo: 'num' },
      { chave: 'imposto_pct', rotulo: 'Impostos sobre receita (%)', tipo: 'num' },
      { chave: 'saldo_inicial', rotulo: 'Saldo inicial de caixa', tipo: 'money' },
      { chave: 'mes_ferias', rotulo: 'Mês padrão das férias', tipo: 'select', opcoes: MESES.map((m, i) => [i + 1, m]) },
      { chave: 'criancas', rotulo: 'Crianças matriculadas', tipo: 'num' },
    ];
    const t = document.createElement('table');
    t.innerHTML = `<tr>${campos.map((f) => `<th>${f.rotulo}</th>`).join('')}</tr>`;
    for (const e of escolas) {
      const tr = t.insertRow();
      for (const f of campos) tr.insertCell().append(campo(f, e[f.chave], (v) => api('PUT', `escolas/${e.id}`, { [f.chave]: v }).then(carregarEscolas)));
    }
    const w = document.createElement('div'); w.className = 'card edit'; w.append(t); root.append(w);
  },
};

// Valor numérico de cada linha da tabela mensal (para a coluna "Ano").
function parseBRLfonte(nome, m) {
  const mapa = {
    'Receita': m.receita, '(-) Salários + benefícios': m.salarios + m.beneficios, '(-) Encargos': m.encargos,
    '(-) Provisão 13º': m.prov13, '(-) Provisão férias': m.provFerias, '(-) Despesas (alimentação etc.)': m.despesas,
    '(-) Impostos': m.impostos, '= Lucro (competência)': m.resultado, 'Entrada de caixa': m.entrada,
    'Saída de caixa': m.saida, '  inclui 13º / férias pagos': m.pagto13 + m.pagtoFerias,
  };
  return mapa[nome] ?? 0;
}

function cartao(titulo, sub, legenda, conteudo) {
  const c = document.createElement('section'); c.className = 'card';
  c.innerHTML = `<h2></h2><div class="sub"></div>`;
  c.querySelector('h2').textContent = titulo; c.querySelector('.sub').textContent = sub;
  if (legenda && legenda.length > 1) {
    const l = document.createElement('div'); l.className = 'legenda';
    for (const [nome, cor] of legenda) l.insertAdjacentHTML('beforeend', `<span><i style="background:var(--${cor})"></i>${nome}</span>`);
    c.append(l);
  }
  if (conteudo) c.append(conteudo);
  return c;
}

const compacto = (v) => {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${s}R$ ${Math.round(a / 1e3)} mil`;
  return `${s}R$ ${Math.round(a)}`;
};

function ticks(lo, hi, n = 4) {
  const bruto = (hi - lo) / n || 1, pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto);
  const out = [];
  for (let v = Math.floor(lo / passo) * passo; v <= hi + passo * 0.001; v += passo) out.push(v);
  return out;
}

// Base comum: eixo, grade, rótulos de mês (com o repasse reduzido) e dica ao passar o mouse.
function base(meses, lo, hi, linhasDica) {
  const W = 900, H = 260, L = 62, R = 12, T = 12, B = 44, bw = (W - L - R) / 12;
  const tk = ticks(lo, hi);
  lo = Math.min(lo, tk[0]); hi = Math.max(hi, tk[tk.length - 1]);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const cx = (i) => L + i * bw + bw / 2;
  const wrap = document.createElement('div'); wrap.className = 'grafico';
  let g = '';
  for (const v of tk) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? 'var(--axis)' : 'var(--grid)'}"/>`;
    g += `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${compacto(v)}</text>`;
  }
  meses.forEach((m, i) => {
    g += `<text x="${cx(i)}" y="${H - 22}" text-anchor="middle" ${m.fator < 1 ? 'style="fill:var(--warn-ink);font-weight:600"' : ''}>${MESES[i]}</text>`;
    if (m.fator < 1) g += `<text x="${cx(i)}" y="${H - 9}" text-anchor="middle" style="fill:var(--warn-ink);font-size:10px">repasse ${Math.round(m.fator * 100)}%</text>`;
  });
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico mensal; os mesmos valores estão na tabela abaixo">${g}<g class="dados"></g><line class="cruz" y1="${T}" y2="${H - B}" stroke="var(--axis)" stroke-dasharray="none" style="display:none"/><rect class="alvo" x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/></svg><div class="tip" hidden></div>`;
  const svg = wrap.querySelector('svg'), tip = wrap.querySelector('.tip'), cruz = wrap.querySelector('.cruz');
  const mostrar = (i) => {
    cruz.setAttribute('x1', cx(i)); cruz.setAttribute('x2', cx(i)); cruz.style.display = '';
    tip.replaceChildren();
    const t = document.createElement('div'); t.className = 'mes'; t.textContent = `${MESES[i]} ${estado.ano}` + (meses[i].fator < 1 ? ` · repasse ${Math.round(meses[i].fator * 100)}%` : ''); tip.append(t);
    for (const [nome, cor, v] of linhasDica(meses[i])) {
      const l = document.createElement('div'); l.className = 'lin';
      const sp = document.createElement('span'); sp.innerHTML = `<i style="background:var(--${cor})"></i>`; sp.append(nome);
      const b = document.createElement('b'); b.textContent = brl(v);
      l.append(sp, b); tip.append(l);
    }
    tip.hidden = false;
    const rect = svg.getBoundingClientRect(), esc = rect.width / W;
    const x = cx(i) * esc, w = tip.offsetWidth;
    tip.style.left = `${x + w + 16 > rect.width ? x - w - 12 : x + 12}px`; tip.style.top = '8px';
  };
  const alvo = wrap.querySelector('.alvo');
  alvo.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    mostrar(Math.max(0, Math.min(11, Math.floor((x - L) / bw))));
  });
  alvo.addEventListener('pointerleave', () => { tip.hidden = true; cruz.style.display = 'none'; });
  return { wrap, y, cx, bw, dados: wrap.querySelector('.dados'), W, H, L, T, B, R };
}

function graficoBarras(meses) {
  const max = Math.max(1, ...meses.flatMap((m) => [m.entrada, m.saida]));
  const c = base(meses, 0, max, (m) => [['Entradas', 's1', m.entrada], ['Saídas', 's2', m.saida]]);
  const larg = 20, gap = 2, y0 = c.y(0);
  const topo = (x, v, cor) => {
    const h = y0 - c.y(v);
    if (h <= 0.5) return '';
    const r = Math.min(4, h);
    const yt = c.y(v);
    return `<path d="M${x},${y0} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + larg - r} Q${x + larg},${yt} ${x + larg},${yt + r} V${y0} Z" fill="var(--${cor})"/>`;
  };
  meses.forEach((m, i) => {
    const x = c.cx(i);
    c.dados.insertAdjacentHTML('beforeend', topo(x - larg - gap / 2, m.entrada, 's1') + topo(x + gap / 2, m.saida, 's2'));
  });
  return c.wrap;
}

function graficoSaldo(meses) {
  const saldos = meses.map((m) => m.saldo);
  const c = base(meses, Math.min(0, ...saldos), Math.max(0, ...saldos), (m) => [['Saldo', 's3', m.saldo]]);
  const pts = meses.map((m, i) => `${c.cx(i)},${c.y(m.saldo)}`);
  const y0 = c.y(0);
  let s = `<polygon points="${c.cx(0)},${y0} ${pts.join(' ')} ${c.cx(11)},${y0}" fill="var(--s3)" opacity=".10"/>`;
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--s3)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const iMin = saldos.indexOf(Math.min(...saldos)), iFim = 11;
  for (const i of new Set([iMin, iFim])) {
    s += `<circle cx="${c.cx(i)}" cy="${c.y(saldos[i])}" r="5" fill="var(--s3)" stroke="var(--surface)" stroke-width="2"/>`;
    const acima = saldos[i] >= 0 || i === iFim;
    const ancora = i === iFim ? 'end' : 'middle';
    s += `<text class="forte" x="${c.cx(i) + (i === iFim ? -2 : 0)}" y="${c.y(saldos[i]) + (saldos[i] < 0 && i !== iFim ? 20 : -10)}" text-anchor="${ancora}">${(i === iMin && i !== iFim ? 'Pior: ' : '') + brl(saldos[i])}</text>`;
  }
  c.dados.innerHTML = s;
  return c.wrap;
}

// ---------- Rescisão ----------
function painelRescisao(root, f) {
  root.querySelector('#rescisao')?.remove();
  const c = document.createElement('section'); c.className = 'card'; c.id = 'rescisao';
  const h = document.createElement('h2'); h.textContent = `Rescisão de ${f.nome}`;
  const sub = document.createElement('div'); sub.className = 'sub';
  sub.textContent = f.data_admissao ? `Admitido(a) em ${f.data_admissao.split('-').reverse().join('/')} · salário ${brl(f.salario)}` : 'Preencha a data de admissão na tabela acima para calcular.';
  c.append(h, sub);
  const form = document.createElement('div'); form.className = 'add';
  const par = { data: new Date().toISOString().slice(0, 10), tipo: 'sem_justa_causa', aviso: 'indenizado', aviso_cumprido: 1 };
  const defs = [
    { chave: 'data', rotulo: 'Data da rescisão', tipo: 'date' },
    { chave: 'tipo', rotulo: 'Motivo', tipo: 'select', opcoes: [['sem_justa_causa', 'Demissão sem justa causa'], ['pedido_demissao', 'Pedido de demissão'], ['acordo', 'Acordo (art. 484-A)'], ['justa_causa', 'Justa causa']] },
    { chave: 'aviso', rotulo: 'Aviso prévio', tipo: 'select', opcoes: [['indenizado', 'Indenizado'], ['trabalhado', 'Trabalhado']] },
    { chave: 'aviso_cumprido', rotulo: 'Aviso cumprido (pedido de demissão)', tipo: 'bool' },
  ];
  for (const d of defs) {
    const lab = document.createElement('label'); lab.append(d.rotulo);
    lab.append(campo(d, par[d.chave], (v) => { par[d.chave] = v; }));
    form.append(lab);
  }
  const sim = document.createElement('button'); sim.textContent = 'Calcular';
  form.append(sim); c.append(form);
  const saida = document.createElement('div'); c.append(saida);
  const qs = () => new URLSearchParams({ funcionario_id: f.id, ...par, aviso_cumprido: par.aviso_cumprido ? '1' : '0' });

  sim.onclick = async () => {
    saida.replaceChildren();
    try {
      const r = await api('GET', `rescisao?${qs()}`);
      const t = document.createElement('table');
      t.innerHTML = '<tr><th>Verba</th><th>Detalhe</th><th>Valor</th></tr>';
      for (const l of r.linhas) {
        const tr = t.insertRow();
        tr.insertCell().textContent = l.nome; tr.insertCell().textContent = l.obs; tr.insertCell().textContent = brl(l.valor);
        if (l.valor < 0) tr.cells[2].className = 'neg';
      }
      const linha = (nome, obs, valor, forte) => { const tr = t.insertRow(); if (forte) tr.className = 'forte'; tr.insertCell().textContent = nome; tr.insertCell().textContent = obs; tr.insertCell().textContent = brl(valor); };
      linha('Total a pagar ao colaborador (bruto)', '', r.totalColaborador, true);
      linha('Depósito de FGTS sobre as verbas', '8%', r.fgts.depositoRescisorio);
      linha(`Multa do FGTS (${pct(r.fgts.pctMulta)})`, `saldo estimado ${brl(r.fgts.saldoEstimado)} · saque ${r.fgts.saqueLiberado}`, r.fgts.multa);
      linha('Custo total para a escola', `data considerada: ${r.dataProjetada.split('-').reverse().join('/')}`, r.custoEscola, true);
      const w = document.createElement('div'); w.className = 'tabela'; w.append(t); saida.append(w);
      const av = document.createElement('ul'); av.className = 'nota';
      for (const a of r.avisos) { const li = document.createElement('li'); li.textContent = a; av.append(li); }
      const ef = document.createElement('button'); ef.textContent = 'Efetivar desligamento';
      ef.onclick = async () => {
        if (!confirm(`Desligar ${f.nome} em ${par.data.split('-').reverse().join('/')} e lançar ${brl(r.custoEscola)} como despesa avulsa (categoria Rescisão)?`)) return;
        await api('POST', 'rescisao', Object.fromEntries(qs())); render();
      };
      saida.append(av, ef);
    } catch (e) { saida.textContent = e.message; }
  };
  root.append(c);
  c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------- Boot ----------
async function render() {
  // Cadastros pertencem a uma escola: com "Todas" no filtro, passa para a primeira em vez de trocar em silêncio.
  if (estado.aba !== 'painel' && estado.escola === 'todas' && estado.escolas.length) {
    estado.escola = estado.escolas[0].id;
    $('#escola').value = estado.escola;
  }
  document.querySelectorAll('#abas button').forEach((b) => b.classList.toggle('on', b.dataset.aba === estado.aba));
  const root = $('#conteudo'); root.innerHTML = '';
  try { await abas[estado.aba](root); } catch (e) { root.textContent = 'Erro: ' + e.message; }
}

async function carregarEscolas() {
  estado.escolas = await api('GET', 'escolas');
  const sel = $('#escola'); sel.innerHTML = '';
  sel.add(new Option('Todas (consolidado)', 'todas'));
  estado.escolas.forEach((e) => sel.add(new Option(e.nome, e.id)));
  sel.value = estado.escola;
  render();
}

$('#abas').innerHTML = ABAS.map(([k, n]) => `<button data-aba="${k}">${n}</button>`).join('');
$('#abas').onclick = (e) => { if (e.target.dataset.aba) { estado.aba = e.target.dataset.aba; render(); } };
$('#escola').onchange = (e) => { estado.escola = e.target.value; render(); };
$('#ano').value = estado.ano;
$('#ano').onchange = (e) => { estado.ano = Number(e.target.value); render(); };
carregarEscolas();
