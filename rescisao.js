import { ErroEntrada } from './erros.js';
// Cálculo de rescisão (CLT) por colaborador. Função pura, valores brutos (sem INSS/IRRF).
//
// Premissas:
//  - Mês comercial de 30 dias; fração >= 15 dias conta como mês inteiro (13º e férias).
//  - Aviso prévio proporcional (Lei 12.506/2011): 30 dias + 3 por ano completo, máx. 90.
//  - Aviso indenizado integra o tempo de serviço (projeta a data para 13º, férias e FGTS).
//  - Saldo de FGTS: se não informado, estimado em 8% do salário por mês trabalhado (+13º).
//  - Não inclui: adicionais/médias variáveis, adiantamentos, faltas, INSS/IRRF do empregado.

export const TIPOS_RESCISAO = {
  sem_justa_causa: 'Demissão sem justa causa',
  acordo: 'Acordo entre as partes (art. 484-A)',
  pedido_demissao: 'Pedido de demissão',
  justa_causa: 'Demissão por justa causa',
};

const r2 = (n) => Math.round(n * 100) / 100;

export const parseData = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) throw new ErroEntrada(`data inválida: ${s}`);
  return { y: +m[1], m: +m[2], d: +m[3] };
};
const utc = ({ y, m, d }) => Date.UTC(y, m - 1, d);
const diasNoMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const somarDias = (dt, n) => {
  const x = new Date(utc(dt) + n * 86400000);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
};
const fmt = ({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Meses completos entre a e b (a <= b).
export const mesesCompletos = (a, b) => (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
const somarMeses = (dt, n) => {
  const t = dt.y * 12 + (dt.m - 1) + n;
  const y = Math.floor(t / 12), m = (t % 12) + 1;
  return { y, m, d: Math.min(dt.d, diasNoMes(y, m)) };
};
const diasEntre = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);

export function calcularRescisao({
  salario, data_admissao, data_rescisao, tipo, aviso = 'indenizado',
  ferias_periodos_gozados = 0, fgts_saldo = null, aviso_cumprido = true,
}) {
  if (!TIPOS_RESCISAO[tipo]) throw new ErroEntrada(`tipo de rescisão inválido: ${tipo}`);
  const adm = parseData(data_admissao), rescOriginal = parseData(data_rescisao);
  if (utc(rescOriginal) < utc(adm)) throw new ErroEntrada('a rescisão não pode ser antes da admissão');

  const justa = tipo === 'justa_causa';
  const dia = salario / 30;
  const avisos = [];
  const linhas = [];
  const add = (nome, valor, obs = '') => { if (valor) linhas.push({ nome, valor: r2(valor), obs }); };

  // Aviso prévio
  const anos = Math.floor(mesesCompletos(adm, rescOriginal) / 12);
  const diasAviso = Math.min(90, 30 + 3 * Math.max(0, anos));
  const indenizado = (tipo === 'sem_justa_causa' || tipo === 'acordo') && aviso === 'indenizado';
  const dt = indenizado ? somarDias(rescOriginal, diasAviso) : rescOriginal; // data projetada

  // Saldo de salário (dias trabalhados no mês da rescisão)
  const diasSaldo = Math.min(30, rescOriginal.d);
  const saldoSalario = dia * diasSaldo;
  add('Saldo de salário', saldoSalario, `${diasSaldo} dias`);

  let avisoValor = 0;
  if (indenizado) {
    avisoValor = dia * diasAviso * (tipo === 'acordo' ? 0.5 : 1);
    add('Aviso prévio indenizado', avisoValor, `${diasAviso} dias${tipo === 'acordo' ? ', 50% (acordo)' : ''}`);
  }
  if (tipo === 'pedido_demissao' && !aviso_cumprido) {
    add('(−) Desconto de aviso prévio não cumprido', -salario, '30 dias');
  }

  // 13º proporcional
  let decimo = 0;
  if (!justa) {
    const primeiro = adm.y === dt.y ? 
      (diasNoMes(adm.y, adm.m) - adm.d + 1 >= 15 ? adm.m : adm.m + 1) : 1;
    const ultimo = dt.d >= 15 ? dt.m : dt.m - 1;
    const avos = Math.max(0, ultimo - primeiro + 1);
    decimo = (salario / 12) * avos;
    add('13º salário proporcional', decimo, `${avos}/12`);
  }

  // Férias
  let feriasVenc = 0, feriasProp = 0;
  const periodosCompletos = Math.floor(mesesCompletos(adm, dt) / 12);
  const vencidas = Math.max(0, periodosCompletos - ferias_periodos_gozados);
  // Férias vencidas são devidas mesmo na justa causa.
  if (vencidas > 0) {
    feriasVenc = vencidas * salario;
    add('Férias vencidas', feriasVenc, `${vencidas} período(s)`);
    add('1/3 constitucional sobre férias vencidas', feriasVenc / 3);
    // Dobra: período vencido há mais de 12 meses sem gozo.
    const fimAquisitivo = somarMeses(adm, 12 * (ferias_periodos_gozados + 1));
    if (utc(dt) > utc(somarMeses(fimAquisitivo, 12))) {
      avisos.push('Há período de férias vencido há mais de 12 meses: possível pagamento em dobro. Confirme com a contabilidade.');
    }
  }
  if (!justa) {
    const ultimoAniv = somarMeses(adm, 12 * periodosCompletos);
    const inteiros = mesesCompletos(ultimoAniv, dt);
    const resto = diasEntre(somarMeses(ultimoAniv, inteiros), dt);
    const avos = Math.min(12, inteiros + (resto >= 15 ? 1 : 0));
    feriasProp = (salario / 12) * avos;
    add('Férias proporcionais', feriasProp, `${avos}/12`);
    add('1/3 constitucional sobre férias proporcionais', feriasProp / 3);
  }

  // FGTS
  const mesesFgts = Math.max(0, mesesCompletos(adm, rescOriginal));
  const saldoFgts = fgts_saldo ?? salario * 0.08 * mesesFgts * (13 / 12);
  const baseFgtsRescisorio = saldoSalario + avisoValor + decimo;
  const fgtsRescisorio = justa && !decimo ? saldoSalario * 0.08 : baseFgtsRescisorio * 0.08;
  const pctMulta = tipo === 'sem_justa_causa' ? 0.4 : tipo === 'acordo' ? 0.2 : 0;
  const multaFgts = (saldoFgts + fgtsRescisorio) * pctMulta;

  const aPagar = linhas.reduce((s, l) => s + l.valor, 0);
  if (fgts_saldo == null) avisos.push('Saldo de FGTS estimado (8% do salário atual × meses trabalhados). Informe o saldo do extrato para o valor exato.');
  if (tipo === 'sem_justa_causa' && aviso === 'trabalhado') avisos.push('Aviso trabalhado: o colaborador cumpre 30+ dias e a rescisão sai ao final; o valor acima é uma projeção pela data informada.');
  avisos.push('Valores brutos: não descontam INSS/IRRF do empregado, adiantamentos nem faltas.');

  return {
    tipo, tipoNome: TIPOS_RESCISAO[tipo],
    dataProjetada: fmt(dt), diasAviso: indenizado || tipo === 'sem_justa_causa' ? diasAviso : 0,
    linhas,
    totalColaborador: r2(aPagar),
    fgts: { saldoEstimado: r2(saldoFgts), depositoRescisorio: r2(fgtsRescisorio), multa: r2(multaFgts), pctMulta,
      saqueLiberado: tipo === 'sem_justa_causa' ? '100%' : tipo === 'acordo' ? '80%' : 'não' },
    // Custo para a escola: verbas + depósito de FGTS sobre as verbas + multa (paga em guia própria).
    custoEscola: r2(aPagar + fgtsRescisorio + multaFgts),
    avisos,
  };
}
