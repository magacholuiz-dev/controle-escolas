import { ErroEntrada } from './erros.js';
// Divide um valor entre escolas. Retorna [{ escola_id, pct, valor }] com os centavos fechando o total.
//  - igual:    partes iguais
//  - criancas: proporcional às matrículas (campo `criancas` da escola)
//  - manual:   percentuais informados em `pcts` ({ [escola_id]: pct }), devem somar 100
export function ratear(total, escolas, modo, pcts = {}) {
  if (!(total > 0)) throw new ErroEntrada('o valor deve ser maior que zero');
  if (escolas.length < 2) throw new ErroEntrada('é preciso ao menos duas escolas para dividir');

  let pesos;
  if (modo === 'igual') pesos = escolas.map(() => 1);
  else if (modo === 'criancas') {
    pesos = escolas.map((e) => e.criancas || 0);
    if (!pesos.some((p) => p > 0)) throw new ErroEntrada('informe o número de crianças de cada escola em Parâmetros');
  } else if (modo === 'manual') {
    pesos = escolas.map((e) => Number(pcts[e.id]) || 0);
    const soma = pesos.reduce((s, p) => s + p, 0);
    if (Math.abs(soma - 100) > 0.01) throw new ErroEntrada(`os percentuais somam ${soma}%, e devem somar 100%`);
  } else throw new ErroEntrada(`modo de divisão inválido: ${modo}`);

  const soma = pesos.reduce((s, p) => s + p, 0);
  const centavos = Math.round(total * 100);
  const partes = pesos.map((p) => Math.floor((centavos * p) / soma));
  let resto = centavos - partes.reduce((s, c) => s + c, 0);
  // Distribui os centavos que sobraram, começando pela escola de maior peso.
  [...pesos.keys()].sort((a, b) => pesos[b] - pesos[a]).forEach((i) => { if (resto > 0) { partes[i]++; resto--; } });
  return escolas.map((e, i) => ({ escola_id: e.id, pct: Math.round((pesos[i] / soma) * 10000) / 100, valor: partes[i] / 100 }));
}
