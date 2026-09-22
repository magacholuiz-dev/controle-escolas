const $ = (s) => document.querySelector(s);
// Every failed API call (create, edit, delete) surfaces to the person instead of disappearing silently.
window.addEventListener('unhandledrejection', (e) => { alert(e.reason?.message || 'Algo deu errado.'); render?.(); });
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const brl = (n) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (n) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (n) => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const cls = (n) => (n < -0.005 ? 'neg' : n > 0.005 ? 'pos' : '');

const api = async (method, url, body) => {
  const r = await fetch('/api/' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error((await r.json()).error || r.statusText);
  return r.json();
};

const state = { schools: [], school: 'all', year: new Date().getFullYear(), tab: 'dashboard' };
const TABS = [
  ['dashboard', 'Painel'], ['revenues', 'Receitas'], ['children', 'Crianças'], ['tuition', 'Mensalidades'],
  ['employees', 'Equipe'], ['expenses', 'Despesas'], ['bills', 'Contas a pagar'], ['suppliers', 'Fornecedores'],
  ['calendar', 'Calendário de repasse'], ['entries', 'Lançamentos reais'], ['settings', 'Parâmetros'],
];
const BILL_STATUS = { pending: ['Pendente', ''], overdue: ['Vencida', 'neg'], paid: ['Paga', 'pos'] };
const TUITION_STATUS = { current: ['Em dia', ''], '1-30': ['Atraso 1–30 dias', 'neg'], '31-60': ['Atraso 31–60 dias', 'neg'], '60+': ['Atraso 60+ dias', 'neg'], paid: ['Paga', 'pos'] };

// ---------- Generic CRUD with in-row editing ----------
function field(f, value, onChange) {
  let el;
  if (f.type === 'select') {
    el = document.createElement('select');
    for (const [v, t] of f.options) el.add(new Option(t, v));
    el.value = value ?? f.options[0][0];
  } else if (f.type === 'bool') {
    el = document.createElement('input'); el.type = 'checkbox'; el.checked = !!value;
  } else {
    el = document.createElement('input');
    el.type = f.type === 'money' || f.type === 'num' ? 'number' : f.type === 'date' ? 'date' : 'text';
    if (el.type === 'number') el.step = '0.01';
    el.value = value ?? '';
  }
  if (onChange) el.addEventListener('change', () => onChange(readField(f, el)));
  return el;
}
const readField = (f, el) => (f.type === 'bool' ? (el.checked ? 1 : 0) : f.type === 'money' || f.type === 'num' ? (el.value === '' ? null : Number(el.value)) : el.value);

async function crud(root, resource, fields, { extra = {}, query = '', defaults = {}, totalKey, actions, extraColumns = [] } = {}) {
  const rows = await api('GET', `${resource}?${query}`);
  const wrap = document.createElement('div'); wrap.className = 'card edit';
  const t = document.createElement('table');
  t.innerHTML = `<tr>${fields.map((f) => `<th>${f.label}</th>`).join('')}${extraColumns.map((c) => `<th>${c.label}</th>`).join('')}<th></th></tr>`;
  for (const row of rows) {
    const tr = t.insertRow();
    for (const f of fields) {
      tr.insertCell().append(field(f, row[f.key], (v) => api('PUT', `${resource}/${row.id}`, { [f.key]: v }).then(render)));
    }
    for (const c of extraColumns) tr.insertCell().innerHTML = c.render(row);
    const cell = tr.insertCell(); cell.className = 'actions';
    if (actions) actions(row, cell);
    if (row.group_id) cell.insertAdjacentHTML('beforeend', `<span class="chip" title="Compra dividida entre as escolas. Total ${brl(row.total_amount)}">dividido ${pct(row.split_pct / 100)}</span>`);
    const b = document.createElement('button'); b.textContent = 'Excluir'; b.className = 'sec';
    b.onclick = async () => {
      const grouped = !!row.group_id;
      if (!confirm(grouped ? 'Este item foi dividido entre as escolas. Excluir a divisão inteira (nas duas escolas)?' : 'Excluir este item?')) return;
      await api('DELETE', `${resource}/${row.id}${grouped ? '?group=1' : ''}`); render();
    };
    cell.append(b);
  }
  if (totalKey) {
    const tr = t.insertRow(); tr.className = 'tot';
    tr.insertCell().textContent = 'Total';
    fields.slice(1).forEach((f) => { tr.insertCell().textContent = f.key === totalKey ? brl(rows.reduce((s, l) => s + (l[totalKey] || 0) * (l.active === 0 ? 0 : 1), 0)) : ''; });
    extraColumns.forEach(() => tr.insertCell());
    tr.insertCell();
  }
  wrap.append(t); root.append(wrap);

  const form = document.createElement('div'); form.className = 'add';
  const newRow = {};
  for (const f of fields) {
    const lab = document.createElement('label'); lab.append(f.label);
    const el = field(f, defaults[f.key], (v) => (newRow[f.key] = v));
    newRow[f.key] = readField(f, el);
    lab.append(el); form.append(lab);
  }
  const add = document.createElement('button'); add.textContent = 'Adicionar';
  add.onclick = async () => { await api('POST', resource, { ...newRow, ...extra }); render(); };
  form.append(add); root.append(form);
}

const targetSchool = () => (state.school === 'all' ? state.schools[0].id : state.school);
const schoolName = () => state.schools.find((e) => e.id === targetSchool()).name;
const CATEGORIES = ['Alimentação', 'Aluguel', 'Água', 'Luz', 'Internet', 'Segurança', 'Material de cozinha', 'Material de limpeza', 'Material pedagógico', 'Manutenção', 'Contabilidade', 'Rescisão', 'Outros'];
const CATEGORY_OPTIONS = CATEGORIES.map((c) => [c, c]);

// Form to split an expense/entry between the schools (proration).
function renderSplitForm(root, resource, { defaults = {}, fields }) {
  const [school1, school2] = state.schools;
  const c = document.createElement('section'); c.className = 'card';
  c.innerHTML = `<h2>Dividir entre as escolas</h2><div class="sub">Um único valor (ex.: compra de panelas e produtos de limpeza) vira um lançamento em cada escola, cada um com a sua parte.</div>`;
  const form = document.createElement('div'); form.className = 'add';
  const data = { ...defaults }; let mode = 'equal', pctSchool1 = 50;
  for (const f of fields) {
    const lab = document.createElement('label'); lab.append(f.label);
    const el = field(f, defaults[f.key], (v) => { data[f.key] = v; preview(); });
    data[f.key] = readField(f, el); lab.append(el); form.append(lab);
  }
  const modeLabel = document.createElement('label'); modeLabel.append('Como dividir');
  const modeSelect = field({ type: 'select', options: [['equal', 'Igual (50/50)'], ['children', 'Proporcional às crianças'], ['manual', 'Percentual manual']] }, 'equal', (v) => { mode = v; pctLabel.hidden = v !== 'manual'; preview(); });
  modeLabel.append(modeSelect); form.append(modeLabel);
  const pctLabel = document.createElement('label'); pctLabel.hidden = true; pctLabel.append(`% para ${school1.name}`);
  const pctInput = field({ type: 'num' }, 50, (v) => { pctSchool1 = v; preview(); }); pctLabel.append(pctInput); form.append(pctLabel);
  const previewEl = document.createElement('div'); previewEl.className = 'note'; previewEl.style.width = '100%';
  const amountKey = resource === 'expenses' ? 'monthly_amount' : 'amount';
  function preview() {
    const total = Number(data[amountKey]) || 0;
    const p1 = mode === 'equal' ? 50 : mode === 'manual' ? pctSchool1 : (school1.children_count / ((school1.children_count + school2.children_count) || 1)) * 100;
    previewEl.textContent = total ? `${school1.name}: ${brl(total * p1 / 100)} (${pct(p1 / 100)}) · ${school2.name}: ${brl(total * (100 - p1) / 100)} (${pct((100 - p1) / 100)})` : '';
  }
  const b = document.createElement('button'); b.textContent = 'Dividir e lançar';
  b.onclick = async () => {
    try {
      await api('POST', 'split', { resource, data, mode, percentages: { [school1.id]: pctSchool1, [school2.id]: 100 - pctSchool1 } });
      render();
    } catch (e) { alert(e.message); }
  };
  form.append(b); c.append(form, previewEl); root.append(c);
}

const MONTH_OPTIONS = [['', 'padrão da escola'], ...MONTHS.map((m, i) => [i + 1, m])];

// ---------- Tabs ----------
const views = {
  async dashboard(root) {
    const r = await api('GET', `report?year=${state.year}&school=${state.school}`);
    const T = r.totals;
    const kpi = (t, v, sub, c = '') => `<div class="card kpi"><div class="t">${t}</div><div class="v ${c}">${v}</div><div class="s">${sub}</div></div>`;
    const negative = r.reserveNeeded > 0;
    const reduced = r.months.filter((m) => m.factor < 1).map((m) => MONTHS[m.month - 1]);
    root.innerHTML = `
      <div class="top">
        <div class="card hero">
          <div class="label">Lucro do ano ${state.year} (competência, já descontadas as provisões)</div>
          <div class="v ${cls(T.result)}">${brl0(T.result)}</div>
          <div class="sub">Margem de ${pct(r.margin)} · receita ${brl0(T.revenue)} − custos ${brl0(T.accrualCost)}</div>
        </div>
        <div class="card status ${negative ? 'bad' : 'good'}">
          <div class="ic" aria-hidden="true">${negative ? '!' : '✓'}</div>
          <div>
            <b>${negative ? 'Caixa fica negativo' : 'Caixa positivo o ano todo'}</b>
            <p>${negative
              ? `Pior momento em <b>${MONTHS[r.minBalanceMonth - 1]}</b> (${brl0(r.minBalance)}). É preciso ter <b>${brl0(r.reserveNeeded)}</b> guardados a mais até lá para pagar salários nos meses sem repasse.`
              : `Menor saldo: ${brl0(r.minBalance)} em ${MONTHS[r.minBalanceMonth - 1]}.`}</p>
            ${reduced.length ? `<p class="sub">Meses com repasse reduzido: ${reduced.join(', ')}.</p>` : ''}
          </div>
        </div>
      </div>
      <div class="kpis">
        ${kpi('Receita do ano', brl0(T.revenue), 'prevista, ou realizada nos meses com lançamento')}
        ${kpi('Custos do ano', brl0(T.accrualCost), 'folha, encargos, 13º, férias, impostos e despesas')}
        ${kpi('Provisão de 13º + férias', brl0(T.thirteenthProvision + T.vacationProvision), 'reserve todo mês, sai do caixa em nov/dez e nas férias')}
        ${kpi('Saldo de caixa em dezembro', brl0(r.finalBalance), 'partindo de ' + brl0(r.initialBalance), cls(r.finalBalance))}
        ${T.derivedRevenue ? kpi('Receita da Prefeitura (crianças)', brl0(T.derivedRevenue), 'crianças × dias letivos × valor por criança-dia') : ''}
      </div>`;
    if (state.school !== 'all') {
      const occ = await api('GET', `children/occupancy?school_id=${state.school}`);
      if (occ.active || occ.capacity) {
        root.querySelector('.kpis').insertAdjacentHTML('beforeend', `<div class="card kpi"><div class="t">Ocupação</div><div class="v">${occ.capacity ? `${occ.active} / ${occ.capacity}` : occ.active}</div><div class="s">${occ.pct != null ? pct(occ.pct) + ' das vagas' : 'crianças matriculadas'}</div></div>`);
      }
    }
    const due = await api('GET', `bills/panel?school=${state.school}&days=7`);
    if (due.overdue.length || due.upcoming.length) {
      const cv = card('Contas a pagar', 'Vencidas e o que vence nos próximos 7 dias', null, null);
      const billRow = (c) => `<tr><td>${c.due_date.split('-').reverse().join('/')}</td><td>${c.description}${state.school === 'all' ? ` · ${c.school}` : ''}</td><td>${c.category}</td><td>${brl(c.amount)}</td></tr>`;
      const tb = document.createElement('div'); tb.className = 'table-wrap';
      tb.innerHTML = `<table><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr>
        ${due.overdue.length ? `<tr class="group"><td colspan="4">Vencidas (${brl(due.totalOverdue)})</td></tr>${due.overdue.map(billRow).join('')}` : ''}
        ${due.upcoming.length ? `<tr class="group"><td colspan="4">Próximos 7 dias (${brl(due.totalUpcoming)})</td></tr>${due.upcoming.map(billRow).join('')}` : ''}
      </table>`;
      cv.append(tb); root.append(cv);
    }
    const delinquency = await api('GET', `tuition/panel?school=${state.school}`);
    if (delinquency.debtors.length) {
      const ci = card('Mensalidades em atraso', `${brl(delinquency.totalOverdue)} em atraso de ${brl(delinquency.totalDue)} vencidos${delinquency.delinquencyPct != null ? ` · inadimplência de ${pct(delinquency.delinquencyPct)}` : ''}`, null, null);
      const tb2 = document.createElement('div'); tb2.className = 'table-wrap';
      tb2.innerHTML = `<table><tr><th>Criança</th>${state.school === 'all' ? '<th>Escola</th>' : ''}<th>Competência</th><th>Vencimento</th><th>Atraso</th><th>Valor</th><th>Cobrança</th></tr>${delinquency.debtors.map((d) => `
        <tr><td>${d.child}</td>${state.school === 'all' ? `<td>${d.school}</td>` : ''}<td>${d.period}</td><td>${d.due_date.split('-').reverse().join('/')}</td>
        <td>${TUITION_STATUS[d.bracket][0]}</td><td>${brl(d.amount)}</td>
        <td><button class="sec copy" data-msg="${d.message.replace(/"/g, '&quot;')}">Copiar mensagem</button></td></tr>`).join('')}</table>`;
      ci.append(tb2); root.append(ci);
      ci.querySelectorAll('.copy').forEach((b) => b.onclick = () => navigator.clipboard?.writeText(b.dataset.msg).then(() => alert('Mensagem copiada.')).catch(() => alert(b.dataset.msg)));
    }
    root.append(card('Entradas e saídas por mês', 'Caixa: o que entra e o que sai de fato em cada mês', [['Entradas', 's1'], ['Saídas', 's2']], barChart(r.months)));
    root.append(card('Saldo de caixa acumulado', 'Quanto dinheiro sobra (ou falta) no fim de cada mês', [['Saldo', 's3', true]], balanceChart(r.months)));

    const lines = [
      ['g', 'Competência (lucro)'],
      ['Receita', 'revenue'],
      ...(r.totals.derivedRevenue ? [['  da qual, crianças × dias letivos', 'derivedRevenue']] : []),
      ['(−) Salários e benefícios', (m) => m.salaries + m.benefits],
      ['(−) Encargos', 'charges'],
      ['(−) Provisão de 13º', 'thirteenthProvision'],
      ['(−) Provisão de férias', 'vacationProvision'],
      ['(−) Despesas (alimentação etc.)', 'expenses'],
      ['(−) Impostos', 'taxes'],
      ['Lucro do mês', 'result', true],
      ['g', 'Caixa'],
      ['Entradas', 'cashIn'],
      ['Saídas', 'cashOut'],
      ['  das quais 13º e férias', (m) => m.thirteenthPayout + m.vacationPayout],
      ['Saldo no fim do mês', 'balance', true, true],
    ];
    const val = (m, k) => (typeof k === 'function' ? k(m) : m[k]);
    const t = document.createElement('table');
    t.innerHTML = `<tr><th></th>${r.months.map((m) => `<th class="${m.factor < 1 ? 'reduced' : ''}">${MONTHS[m.month - 1]}${m.factor < 1 ? `<span class="tag">repasse ${pct(m.factor)}</span>` : ''}</th>`).join('')}<th>Ano</th></tr>` +
      lines.map(([name, k, strong, noTotal]) => {
        if (name === 'g') return `<tr class="group"><td colspan="14">${k}</td></tr>`;
        const tds = r.months.map((m) => {
          const v = val(m, k);
          const c = strong ? cls(v) : '';
          return `<td class="${c}${m.factor < 1 && name === 'Receita' ? ' reduced' : ''}">${brl(v)}</td>`;
        }).join('');
        const tot = noTotal ? '' : brl(r.months.reduce((s, m) => s + val(m, k), 0));
        return `<tr class="${strong ? 'strong' : ''}"><td>${name}</td>${tds}<td>${tot}</td></tr>`;
      }).join('');
    const c = card('Mês a mês', 'Meses em amarelo têm repasse reduzido da Prefeitura. Meses fechados usam só o realizado no caixa.', null, null);
    const w = document.createElement('div'); w.className = 'table-wrap'; w.append(t); c.append(w); root.append(c);

    if (r.categories?.length) {
      const cc = card('Despesas por categoria', 'Previsto no orçamento x realizado nos lançamentos do ano (folha não entra aqui)', null, null);
      const tb = document.createElement('div'); tb.className = 'table-wrap';
      const cats = [...r.categories].sort((a, b) => Math.max(b.budgeted, b.actual) - Math.max(a.budgeted, a.actual));
      tb.innerHTML = `<table><tr><th>Categoria</th><th>Previsto</th><th>Realizado</th><th>Diferença</th></tr>${cats.map((c) => {
        const d = c.actual - c.budgeted;
        return `<tr><td>${c.category}</td><td>${brl0(c.budgeted)}</td><td>${c.actual ? brl0(c.actual) : '—'}</td><td class="${c.actual ? (d > 0 ? 'neg' : 'pos') : ''}">${c.actual ? (d > 0 ? '▲ ' : '▼ ') + brl0(Math.abs(d)) : ''}</td></tr>`;
      }).join('')}</table>`;
      cc.append(tb); root.append(cc);
    }
    if (r.bySchool) {
      const p = card('Por escola', 'Resultado do ano por competência', null, null);
      const tb = document.createElement('div'); tb.className = 'table-wrap';
      tb.innerHTML = `<table><tr><th>Escola</th><th>Receita</th><th>Custos</th><th>Lucro</th></tr>${r.bySchool.map((e) => `<tr><td>${e.name}</td><td>${brl(e.revenue)}</td><td>${brl(e.accrualCost)}</td><td class="${cls(e.result)}">${brl(e.result)}</td></tr>`).join('')}</table>`;
      p.append(tb); root.append(p);
    }
  },

  async revenues(root) {
    root.innerHTML = `<p class="note">Receitas recorrentes de <b>${schoolName()}</b>. Marque "segue calendário" no contrato da Prefeitura: o valor mensal é multiplicado pelo fator de repasse de cada mês (0% em janeiro e julho, 50% em fevereiro, por padrão). Mensalidades particulares normalmente não seguem o calendário.</p>`;
    await crud(root, 'revenues', [
      { key: 'description', label: 'Descrição', type: 'text' },
      { key: 'monthly_amount', label: 'Valor mensal cheio', type: 'money' },
      { key: 'follows_calendar', label: 'Segue calendário da Prefeitura', type: 'bool' },
    ], { extra: { school_id: targetSchool() }, query: `school_id=${targetSchool()}`, defaults: { follows_calendar: 1 }, totalKey: 'monthly_amount' });
  },

  async employees(root) {
    root.innerHTML = `<p class="note">Equipe de <b>${schoolName()}</b>. Cadastre cada colaborador com a data de admissão para calcular a rescisão de cada um. Encargos, 13º e férias saem do salário (percentuais em Parâmetros). Benefícios (VT/VA) entram só na folha mensal. "Férias já gozadas" é o número de períodos aquisitivos completos que o colaborador já tirou.</p>`;
    await crud(root, 'employees', [
      { key: 'name', label: 'Nome', type: 'text' },
      { key: 'cpf', label: 'CPF', type: 'text' },
      { key: 'role', label: 'Cargo', type: 'text' },
      { key: 'salary', label: 'Salário', type: 'money' },
      { key: 'benefits', label: 'Benefícios/mês', type: 'money' },
      { key: 'hire_date', label: 'Admissão', type: 'date' },
      { key: 'vacation_periods_taken', label: 'Férias já gozadas (períodos)', type: 'num' },
      { key: 'fgts_balance', label: 'Saldo FGTS (extrato)', type: 'money' },
      { key: 'vacation_month', label: 'Mês das férias', type: 'select', options: MONTH_OPTIONS },
      { key: 'active', label: 'Ativo', type: 'bool' },
      { key: 'termination_date', label: 'Desligamento', type: 'date' },
    ], {
      extra: { school_id: targetSchool() }, query: `school_id=${targetSchool()}`, defaults: { active: 1, benefits: 0, vacation_periods_taken: 0 }, totalKey: 'salary',
      actions: (e, cell) => {
        const b = document.createElement('button'); b.textContent = 'Rescisão';
        b.onclick = () => renderSeverancePanel(root, e);
        cell.append(b);
      },
    });
  },

  async expenses(root) {
    root.innerHTML = `<p class="note">Despesas mensais de <b>${schoolName()}</b>: água, luz, internet, segurança, alimentação, aluguel etc. Informe a média mensal; as contas reais do mês entram em Lançamentos e aparecem no comparativo previsto x realizado. "Segue calendário" serve para gastos que só existem com as crianças na escola, como alimentação.</p>`;
    const fields = [
      { key: 'description', label: 'Descrição', type: 'text' },
      { key: 'category', label: 'Categoria', type: 'select', options: CATEGORY_OPTIONS },
      { key: 'monthly_amount', label: 'Valor mensal cheio', type: 'money' },
      { key: 'follows_calendar', label: 'Segue calendário', type: 'bool' },
      { key: 'due_day', label: 'Dia do vencimento', type: 'num' },
    ];
    await crud(root, 'expenses', fields, { extra: { school_id: targetSchool() }, query: `school_id=${targetSchool()}`, defaults: { category: 'Alimentação', due_day: 10 }, totalKey: 'monthly_amount' });
    renderSplitForm(root, 'expenses', { fields, defaults: { category: 'Segurança', follows_calendar: 0 } });
  },

  async bills(root) {
    const id = targetSchool();
    root.innerHTML = `<p class="note">Contas a pagar de <b>${schoolName()}</b>: água, luz, internet, segurança, fornecedores. "Gerar contas do mês" cria uma conta para cada despesa recorrente (cadastrada em Despesas), no dia de vencimento configurado. Pagar lança o valor real no realizado; o previsto x realizado do Painel usa esse valor.</p>`;
    const generate = document.createElement('div'); generate.className = 'add';
    const currentPeriod = new Date().toISOString().slice(0, 7);
    let period = currentPeriod;
    const lab = document.createElement('label'); lab.append('Competência');
    const monthInput = document.createElement('input'); monthInput.type = 'month'; monthInput.value = currentPeriod;
    monthInput.onchange = () => { period = monthInput.value; };
    lab.append(monthInput); generate.append(lab);
    const generateBtn = document.createElement('button'); generateBtn.textContent = 'Gerar contas do mês';
    generateBtn.onclick = async () => {
      const r = await api('POST', 'bills/generate', { school_id: id, period });
      alert(r.created ? `${r.created} conta(s) criada(s) para ${period}.` : 'Nenhuma conta nova: já foram geradas para este mês.');
      render();
    };
    generate.append(generateBtn); root.append(generate);

    const suppliers = await api('GET', 'suppliers');
    const fields = [
      { key: 'description', label: 'Descrição', type: 'text' },
      { key: 'category', label: 'Categoria', type: 'select', options: CATEGORY_OPTIONS },
      { key: 'supplier_id', label: 'Fornecedor', type: 'select', options: [['', '—'], ...suppliers.map((s) => [s.id, s.name])] },
      { key: 'period', label: 'Competência', type: 'text' },
      { key: 'due_date', label: 'Vencimento', type: 'date' },
      { key: 'amount', label: 'Valor', type: 'money' },
    ];
    await crud(root, 'bills', fields, {
      extra: { school_id: id }, query: `school_id=${id}`,
      defaults: { category: 'Outros', period: currentPeriod, due_date: `${currentPeriod}-10` },
      extraColumns: [{ label: 'Status', render: (l) => { const [t, c] = BILL_STATUS[l.status] || ['—', '']; return `<span class="${c}">${t}</span>`; } }],
      actions: (row, cell) => {
        if (row.status === 'paid') {
          const b = document.createElement('button'); b.textContent = 'Desfazer'; b.className = 'sec';
          b.onclick = async () => { if (confirm('Desfazer o pagamento? O lançamento correspondente será removido.')) { await api('POST', `bills/${row.id}/undo`); render(); } };
          cell.append(b);
        } else {
          const b = document.createElement('button'); b.textContent = 'Pagar';
          b.onclick = async () => {
            const amount = prompt('Valor pago:', row.amount);
            if (amount === null) return;
            const date = prompt('Data do pagamento (AAAA-MM-DD):', new Date().toISOString().slice(0, 10));
            if (date === null) return;
            await api('POST', `bills/${row.id}/pay`, { amount_paid: Number(amount), paid_at: date });
            render();
          };
          cell.append(b);
        }
      },
    });
    renderSplitForm(root, 'bills', { fields: fields.filter((f) => f.key !== 'supplier_id'), defaults: { category: 'Segurança', period: currentPeriod, due_date: `${currentPeriod}-10` } });
  },

  async suppliers(root) {
    root.innerHTML = '<p class="note">Fornecedores usados nas contas a pagar (compartilhado entre as escolas).</p>';
    await crud(root, 'suppliers', [
      { key: 'name', label: 'Nome', type: 'text' },
      { key: 'tax_id', label: 'CNPJ/CPF', type: 'text' },
      { key: 'contact', label: 'Contato', type: 'text' },
    ], {});
  },

  async children(root) {
    const id = targetSchool();
    const school = state.schools.find((e) => e.id === id);
    const occ = await api('GET', `children/occupancy?school_id=${id}`);
    root.innerHTML = `<p class="note">Crianças matriculadas em <b>${schoolName()}</b>. Vaga "Prefeitura" entra na receita derivada (crianças × dias letivos × valor por criança-dia, em Parâmetros). Vaga "Particular" gera mensalidade na aba <b>Mensalidades</b>, a partir do valor cadastrado aqui. Sem data de saída, a criança conta como matriculada até hoje. <b>Importante:</b> assim que a 1ª criança de vaga Prefeitura for cadastrada, a receita manual "Contrato Prefeitura" para de contar — cadastre todas as crianças dessa vaga antes de confiar no Painel, ou a receita vai parecer menor do que é.</p>`;
    root.insertAdjacentHTML('beforeend', `<div class="kpis"><div class="card kpi"><div class="t">Ocupação</div><div class="v">${occ.capacity ? `${occ.active} / ${occ.capacity}` : occ.active}</div><div class="s">${occ.pct != null ? pct(occ.pct) + ' das vagas · capacidade em Parâmetros' : 'cadastre a capacidade em Parâmetros para ver o percentual'}</div></div></div>`);
    if (!school?.child_daily_rate) root.insertAdjacentHTML('beforeend', '<div class="warning" style="margin-top:14px">Cadastre o <b>valor por criança-dia da Prefeitura</b> em Parâmetros para as crianças de vaga "Prefeitura" gerarem receita automaticamente.</div>');
    await crud(root, 'children', [
      { key: 'name', label: 'Nome', type: 'text' },
      { key: 'classroom', label: 'Turma', type: 'text' },
      { key: 'enrollment_type', label: 'Vaga', type: 'select', options: [['public', 'Prefeitura'], ['private', 'Particular']] },
      { key: 'tuition_amount', label: 'Mensalidade (particular)', type: 'money' },
      { key: 'birth_date', label: 'Nascimento', type: 'date' },
      { key: 'guardian_name', label: 'Responsável', type: 'text' },
      { key: 'guardian_phone', label: 'Telefone', type: 'text' },
      { key: 'enrollment_date', label: 'Matrícula', type: 'date' },
      { key: 'exit_date', label: 'Saída', type: 'date' },
    ], { extra: { school_id: id }, query: `school_id=${id}`, defaults: { enrollment_type: 'public', tuition_amount: 0 } });
  },

  async tuition(root) {
    const id = targetSchool();
    root.innerHTML = `<p class="note">Mensalidades das crianças de vaga particular em <b>${schoolName()}</b>. "Gerar mensalidades do mês" cria uma para cada criança particular ativa, no dia de vencimento da escola (Parâmetros), a partir do valor cadastrado em Crianças. O desconto é aplicado por mensalidade (ex.: bolsa, irmãos).</p>`;
    const generate = document.createElement('div'); generate.className = 'add';
    const currentPeriod = new Date().toISOString().slice(0, 7);
    let period = currentPeriod;
    const lab = document.createElement('label'); lab.append('Competência');
    const monthInput = document.createElement('input'); monthInput.type = 'month'; monthInput.value = currentPeriod;
    monthInput.onchange = () => { period = monthInput.value; };
    lab.append(monthInput); generate.append(lab);
    const generateBtn = document.createElement('button'); generateBtn.textContent = 'Gerar mensalidades do mês';
    generateBtn.onclick = async () => {
      const r = await api('POST', 'tuition/generate', { school_id: id, period });
      alert(r.created ? `${r.created} mensalidade(s) criada(s) para ${period}.` : 'Nenhuma mensalidade nova: já foram geradas para este mês, ou não há crianças de vaga particular com valor cadastrado.');
      render();
    };
    generate.append(generateBtn); root.append(generate);

    const children = await api('GET', `children?school_id=${id}`);
    await crud(root, 'tuition', [
      { key: 'child_id', label: 'Criança', type: 'select', options: [['', '—'], ...children.filter((c) => c.enrollment_type === 'private').map((c) => [c.id, c.name])] },
      { key: 'period', label: 'Competência', type: 'text' },
      { key: 'due_date', label: 'Vencimento', type: 'date' },
      { key: 'base_amount', label: 'Valor base', type: 'money' },
      { key: 'discount', label: 'Desconto', type: 'money' },
    ], {
      extra: { school_id: id }, query: `school_id=${id}`, defaults: { period: currentPeriod, due_date: `${currentPeriod}-10`, discount: 0 },
      extraColumns: [
        { label: 'Cobrança', render: (l) => brl(Math.max(0, (l.base_amount || 0) - (l.discount || 0))) },
        { label: 'Status', render: (l) => { const [t, c] = TUITION_STATUS[l.status] || ['—', '']; return `<span class="${c}">${t}</span>`; } },
      ],
      actions: (row, cell) => {
        if (row.status === 'paid') {
          const b = document.createElement('button'); b.textContent = 'Desfazer'; b.className = 'sec';
          b.onclick = async () => { if (confirm('Desfazer o pagamento? O lançamento correspondente será removido.')) { await api('POST', `tuition/${row.id}/undo`); render(); } };
          cell.append(b);
        } else {
          const b = document.createElement('button'); b.textContent = 'Pagar';
          b.onclick = async () => {
            const charge = Math.max(0, (row.base_amount || 0) - (row.discount || 0));
            const amount = prompt('Valor pago:', charge);
            if (amount === null) return;
            const date = prompt('Data do pagamento (AAAA-MM-DD):', new Date().toISOString().slice(0, 10));
            if (date === null) return;
            await api('POST', `tuition/${row.id}/pay`, { amount_paid: Number(amount), paid_at: date });
            render();
          };
          cell.append(b);
        }
      },
    });
  },

  async calendar(root) {
    const id = targetSchool();
    const cal = await api('GET', `calendar?school_id=${id}&year=${state.year}`);
    root.innerHTML = `<p class="note">Calendário de <b>${schoolName()}</b>, ${state.year}. <b>Fator de repasse</b> da Prefeitura: 1 = mês inteiro, 0,5 = metade, 0 = nada — usado nas despesas que seguem o calendário. <b>Dias letivos</b>: usado só para calcular a receita da Prefeitura a partir das crianças cadastradas (aba Crianças); não afeta o fator nem as despesas. <b>Mês fechado</b>: o caixa passa a usar só os lançamentos reais do mês. Feche o mês quando todas as contas já estiverem lançadas.</p>`;
    const t = document.createElement('table');
    t.innerHTML = `<tr><th></th>${MONTHS.map((m) => `<th>${m}</th>`).join('')}</tr>`;
    const factorRow = t.insertRow(); factorRow.insertCell().textContent = 'Fator de repasse';
    const daysRow = t.insertRow(); daysRow.insertCell().textContent = 'Dias letivos';
    const closedRow = t.insertRow(); closedRow.insertCell().textContent = 'Mês fechado';
    for (const c of cal) {
      const el = document.createElement('input'); el.type = 'number'; el.step = '0.05'; el.min = 0; el.max = 1; el.value = c.factor;
      el.onchange = () => api('PUT', `calendar?school_id=${id}&year=${state.year}`, { month: c.month, factor: el.value });
      factorRow.insertCell().append(el);
      const dl = document.createElement('input'); dl.type = 'number'; dl.min = 0; dl.max = 31; dl.value = c.school_days ?? '';
      dl.onchange = () => api('PUT', `calendar?school_id=${id}&year=${state.year}`, { month: c.month, school_days: dl.value === '' ? null : dl.value });
      daysRow.insertCell().append(dl);
      const ck = document.createElement('input'); ck.type = 'checkbox'; ck.checked = !!c.closed;
      ck.onchange = () => api('PUT', `calendar?school_id=${id}&year=${state.year}`, { month: c.month, closed: ck.checked });
      closedRow.insertCell().append(ck);
    }
    const w = document.createElement('div'); w.className = 'card edit'; w.append(t); root.append(w);
  },

  async entries(root) {
    root.innerHTML = `<p class="note">Lance o que realmente entrou e saiu em <b>${schoolName()}</b>: contas de água, luz, internet, segurança, compras. Elas alimentam o comparativo previsto x realizado no Painel. Marque <b>fora do orçamento</b> para gastos que não estavam previstos (compra pontual, rescisão): eles somam ao previsto do mês. Para fechar o mês com o realizado, use Calendário de repasse.</p>`;
    const fields = [
      { key: 'date', label: 'Data', type: 'date' },
      { key: 'type', label: 'Tipo', type: 'select', options: [['revenue', 'Receita'], ['expense', 'Despesa']] },
      { key: 'category', label: 'Categoria', type: 'select', options: CATEGORY_OPTIONS },
      { key: 'description', label: 'Descrição', type: 'text' },
      { key: 'amount', label: 'Valor', type: 'money' },
      { key: 'one_off', label: 'Fora do orçamento', type: 'bool' },
    ];
    const today = new Date().toISOString().slice(0, 10);
    await crud(root, 'entries', fields, { extra: { school_id: targetSchool() }, query: `school_id=${targetSchool()}&year=${state.year}`, defaults: { date: today, type: 'expense', category: 'Luz', one_off: 0 } });
    renderSplitForm(root, 'entries', { fields: fields.filter((f) => f.key !== 'type'), defaults: { date: today, type: 'expense', category: 'Material de limpeza', one_off: 1 } });
  },

  async settings(root) {
    root.innerHTML = '<p class="note">Percentuais por escola. <b>Encargos</b>: FGTS 8% (Simples Nacional); se a escola não for do Simples, some INSS patronal/RAT/terceiros. <b>Imposto</b>: alíquota efetiva sobre a receita — confirme com a contabilidade. <b>Saldo inicial</b>: caixa em 1º de janeiro. <b>Crianças matriculadas</b>: campo manual, usado para dividir compras proporcionalmente entre as escolas (independente da aba Crianças). <b>Capacidade</b>: vagas totais, para a ocupação. <b>Valor por criança-dia (Prefeitura)</b>: assim que houver ao menos uma criança de vaga da Prefeitura cadastrada, a receita passa a ser crianças × dias letivos × esse valor, no lugar da receita manual "segue calendário".</p>';
    const schools = await api('GET', 'schools');
    const fields = [
      { key: 'name', label: 'Nome', type: 'text' },
      { key: 'payroll_tax_pct', label: 'Encargos sobre folha (%)', type: 'num' },
      { key: 'tax_pct', label: 'Impostos sobre receita (%)', type: 'num' },
      { key: 'initial_balance', label: 'Saldo inicial de caixa', type: 'money' },
      { key: 'vacation_month', label: 'Mês padrão das férias', type: 'select', options: MONTHS.map((m, i) => [i + 1, m]) },
      { key: 'children_count', label: 'Crianças matriculadas (rateio)', type: 'num' },
      { key: 'capacity', label: 'Capacidade (vagas)', type: 'num' },
      { key: 'child_daily_rate', label: 'Valor por criança-dia (Prefeitura)', type: 'money' },
      { key: 'tuition_due_day', label: 'Dia de vencimento das mensalidades', type: 'num' },
    ];
    const t = document.createElement('table');
    t.innerHTML = `<tr>${fields.map((f) => `<th>${f.label}</th>`).join('')}</tr>`;
    for (const e of schools) {
      const tr = t.insertRow();
      for (const f of fields) tr.insertCell().append(field(f, e[f.key], (v) => api('PUT', `schools/${e.id}`, { [f.key]: v }).then(loadSchools)));
    }
    const w = document.createElement('div'); w.className = 'card edit'; w.append(t); root.append(w);
  },
};

function card(title, sub, legend, content) {
  const c = document.createElement('section'); c.className = 'card';
  c.innerHTML = `<h2></h2><div class="sub"></div>`;
  c.querySelector('h2').textContent = title; c.querySelector('.sub').textContent = sub;
  if (legend && legend.length > 1) {
    const l = document.createElement('div'); l.className = 'legend';
    for (const [name, color] of legend) l.insertAdjacentHTML('beforeend', `<span><i style="background:var(--${color})"></i>${name}</span>`);
    c.append(l);
  }
  if (content) c.append(content);
  return c;
}

const compact = (v) => {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${s}R$ ${Math.round(a / 1e3)} mil`;
  return `${s}R$ ${Math.round(a)}`;
};

function ticks(lo, hi, n = 4) {
  const raw = (hi - lo) / n || 1, magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((p) => p >= raw);
  const out = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(v);
  return out;
}

// Shared base: axis, grid, month labels (with reduced transfer) and the hover tooltip.
function chartBase(months, lo, hi, tooltipLines) {
  const W = 900, H = 260, L = 62, R = 12, T = 12, B = 44, bw = (W - L - R) / 12;
  const tk = ticks(lo, hi);
  lo = Math.min(lo, tk[0]); hi = Math.max(hi, tk[tk.length - 1]);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const cx = (i) => L + i * bw + bw / 2;
  const wrap = document.createElement('div'); wrap.className = 'chart';
  let g = '';
  for (const v of tk) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? 'var(--axis)' : 'var(--grid)'}"/>`;
    g += `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`;
  }
  months.forEach((m, i) => {
    g += `<text x="${cx(i)}" y="${H - 22}" text-anchor="middle" ${m.factor < 1 ? 'style="fill:var(--warn-ink);font-weight:600"' : ''}>${MONTHS[i]}</text>`;
    if (m.factor < 1) g += `<text x="${cx(i)}" y="${H - 9}" text-anchor="middle" style="fill:var(--warn-ink);font-size:10px">repasse ${Math.round(m.factor * 100)}%</text>`;
  });
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico mensal; os mesmos valores estão na tabela abaixo">${g}<g class="data"></g><line class="crosshair" y1="${T}" y2="${H - B}" stroke="var(--axis)" stroke-dasharray="none" style="display:none"/><rect class="target" x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/></svg><div class="tip" hidden></div>`;
  const svg = wrap.querySelector('svg'), tip = wrap.querySelector('.tip'), crosshair = wrap.querySelector('.crosshair');
  const show = (i) => {
    crosshair.setAttribute('x1', cx(i)); crosshair.setAttribute('x2', cx(i)); crosshair.style.display = '';
    tip.replaceChildren();
    const t = document.createElement('div'); t.className = 'month'; t.textContent = `${MONTHS[i]} ${state.year}` + (months[i].factor < 1 ? ` · repasse ${Math.round(months[i].factor * 100)}%` : ''); tip.append(t);
    for (const [name, color, v] of tooltipLines(months[i])) {
      const l = document.createElement('div'); l.className = 'row';
      const sp = document.createElement('span'); sp.innerHTML = `<i style="background:var(--${color})"></i>`; sp.append(name);
      const b = document.createElement('b'); b.textContent = brl(v);
      l.append(sp, b); tip.append(l);
    }
    tip.hidden = false;
    const rect = svg.getBoundingClientRect(), scale = rect.width / W;
    const x = cx(i) * scale, w = tip.offsetWidth;
    tip.style.left = `${x + w + 16 > rect.width ? x - w - 12 : x + 12}px`; tip.style.top = '8px';
  };
  const target = wrap.querySelector('.target');
  target.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    show(Math.max(0, Math.min(11, Math.floor((x - L) / bw))));
  });
  target.addEventListener('pointerleave', () => { tip.hidden = true; crosshair.style.display = 'none'; });
  return { wrap, y, cx, bw, data: wrap.querySelector('.data'), W, H, L, T, B, R };
}

function barChart(months) {
  const max = Math.max(1, ...months.flatMap((m) => [m.cashIn, m.cashOut]));
  const c = chartBase(months, 0, max, (m) => [['Entradas', 's1', m.cashIn], ['Saídas', 's2', m.cashOut]]);
  const barWidth = 20, gap = 2, y0 = c.y(0);
  const bar = (x, v, color) => {
    const h = y0 - c.y(v);
    if (h <= 0.5) return '';
    const r = Math.min(4, h);
    const yt = c.y(v);
    return `<path d="M${x},${y0} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + barWidth - r} Q${x + barWidth},${yt} ${x + barWidth},${yt + r} V${y0} Z" fill="var(--${color})"/>`;
  };
  months.forEach((m, i) => {
    const x = c.cx(i);
    c.data.insertAdjacentHTML('beforeend', bar(x - barWidth - gap / 2, m.cashIn, 's1') + bar(x + gap / 2, m.cashOut, 's2'));
  });
  return c.wrap;
}

function balanceChart(months) {
  const balances = months.map((m) => m.balance);
  const c = chartBase(months, Math.min(0, ...balances), Math.max(0, ...balances), (m) => [['Saldo', 's3', m.balance]]);
  const pts = months.map((m, i) => `${c.cx(i)},${c.y(m.balance)}`);
  const y0 = c.y(0);
  let s = `<polygon points="${c.cx(0)},${y0} ${pts.join(' ')} ${c.cx(11)},${y0}" fill="var(--s3)" opacity=".10"/>`;
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--s3)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const iMin = balances.indexOf(Math.min(...balances)), iLast = 11;
  for (const i of new Set([iMin, iLast])) {
    s += `<circle cx="${c.cx(i)}" cy="${c.y(balances[i])}" r="5" fill="var(--s3)" stroke="var(--surface)" stroke-width="2"/>`;
    const anchor = i === iLast ? 'end' : 'middle';
    s += `<text class="strong" x="${c.cx(i) + (i === iLast ? -2 : 0)}" y="${c.y(balances[i]) + (balances[i] < 0 && i !== iLast ? 20 : -10)}" text-anchor="${anchor}">${(i === iMin && i !== iLast ? 'Pior: ' : '') + brl(balances[i])}</text>`;
  }
  c.data.innerHTML = s;
  return c.wrap;
}

// ---------- Severance ----------
function renderSeverancePanel(root, employee) {
  root.querySelector('#severance')?.remove();
  const c = document.createElement('section'); c.className = 'card'; c.id = 'severance';
  const h = document.createElement('h2'); h.textContent = `Rescisão de ${employee.name}`;
  const sub = document.createElement('div'); sub.className = 'sub';
  sub.textContent = employee.hire_date ? `Admitido(a) em ${employee.hire_date.split('-').reverse().join('/')} · salário ${brl(employee.salary)}` : 'Preencha a data de admissão na tabela acima para calcular.';
  c.append(h, sub);
  const form = document.createElement('div'); form.className = 'add';
  const params = { date: new Date().toISOString().slice(0, 10), type: 'without_cause', notice: 'paid_in_lieu', notice_worked: 1 };
  const defs = [
    { key: 'date', label: 'Data da rescisão', type: 'date' },
    { key: 'type', label: 'Motivo', type: 'select', options: [['without_cause', 'Demissão sem justa causa'], ['resignation', 'Pedido de demissão'], ['mutual_agreement', 'Acordo (art. 484-A)'], ['for_cause', 'Justa causa']] },
    { key: 'notice', label: 'Aviso prévio', type: 'select', options: [['paid_in_lieu', 'Indenizado'], ['worked', 'Trabalhado']] },
    { key: 'notice_worked', label: 'Aviso cumprido (pedido de demissão)', type: 'bool' },
  ];
  for (const d of defs) {
    const lab = document.createElement('label'); lab.append(d.label);
    lab.append(field(d, params[d.key], (v) => { params[d.key] = v; }));
    form.append(lab);
  }
  const sim = document.createElement('button'); sim.textContent = 'Calcular';
  form.append(sim); c.append(form);
  const output = document.createElement('div'); c.append(output);
  const qs = () => new URLSearchParams({ employee_id: employee.id, ...params, notice_worked: params.notice_worked ? '1' : '0' });

  sim.onclick = async () => {
    output.replaceChildren();
    try {
      const r = await api('GET', `severance?${qs()}`);
      const t = document.createElement('table');
      t.innerHTML = '<tr><th>Verba</th><th>Detalhe</th><th>Valor</th></tr>';
      for (const l of r.lines) {
        const tr = t.insertRow();
        tr.insertCell().textContent = l.name; tr.insertCell().textContent = l.note; tr.insertCell().textContent = brl(l.amount);
        if (l.amount < 0) tr.cells[2].className = 'neg';
      }
      const line = (name, note, amount, strong) => { const tr = t.insertRow(); if (strong) tr.className = 'strong'; tr.insertCell().textContent = name; tr.insertCell().textContent = note; tr.insertCell().textContent = brl(amount); };
      line('Total a pagar ao colaborador (bruto)', '', r.totalToEmployee, true);
      line('Depósito de FGTS sobre as verbas', '8%', r.fgts.severanceDeposit);
      line(`Multa do FGTS (${pct(r.fgts.finePct)})`, `saldo estimado ${brl(r.fgts.estimatedBalance)} · saque ${r.fgts.withdrawalAllowed}`, r.fgts.fine);
      line('Custo total para a escola', `data considerada: ${r.projectedDate.split('-').reverse().join('/')}`, r.schoolCost, true);
      const w = document.createElement('div'); w.className = 'table-wrap'; w.append(t); output.append(w);
      const warnings = document.createElement('ul'); warnings.className = 'note';
      for (const a of r.warnings) { const li = document.createElement('li'); li.textContent = a; warnings.append(li); }
      const apply = document.createElement('button'); apply.textContent = 'Efetivar desligamento';
      apply.onclick = async () => {
        if (!confirm(`Desligar ${employee.name} em ${params.date.split('-').reverse().join('/')} e lançar ${brl(r.schoolCost)} como despesa avulsa (categoria Rescisão)?`)) return;
        await api('POST', 'severance', Object.fromEntries(qs())); render();
      };
      output.append(warnings, apply);
    } catch (e) { output.textContent = e.message; }
  };
  root.append(c);
  c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------- Boot ----------
async function render() {
  // Records belong to one school: with "All" in the filter, switch to the first one instead of silently swapping later.
  if (state.tab !== 'dashboard' && state.school === 'all' && state.schools.length) {
    state.school = state.schools[0].id;
    $('#school').value = state.school;
  }
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
  const root = $('#content'); root.innerHTML = '';
  try { await views[state.tab](root); } catch (e) { root.textContent = 'Erro: ' + e.message; }
}

async function loadSchools() {
  state.schools = await api('GET', 'schools');
  const sel = $('#school'); sel.innerHTML = '';
  sel.add(new Option('Todas (consolidado)', 'all'));
  state.schools.forEach((e) => sel.add(new Option(e.name, e.id)));
  sel.value = state.school;
  render();
}

$('#tabs').innerHTML = TABS.map(([k, n]) => `<button data-tab="${k}">${n}</button>`).join('');
$('#tabs').onclick = (e) => { if (e.target.dataset.tab) { state.tab = e.target.dataset.tab; render(); } };
$('#school').onchange = (e) => { state.school = e.target.value; render(); };
$('#year').value = state.year;
$('#year').onchange = (e) => { state.year = Number(e.target.value); render(); };
loadSchools();
