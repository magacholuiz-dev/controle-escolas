import assert from 'node:assert/strict';
import { calcularEscola } from './calc.js';

const fatores = [0, 0.5, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1];
const r = calcularEscola({
  escola: { encargos_pct: 8, imposto_pct: 6, saldo_inicial: 0, mes_ferias: 1 },
  funcionarios: [{ salario: 3000, beneficios: 500, ativo: 1, mes_ferias: null }, { salario: 9999, beneficios: 0, ativo: 0 }],
  receitas: [{ valor_mensal: 20000, segue_calendario: 1 }],
  despesas: [{ valor_mensal: 2000, segue_calendario: 1 }, { valor_mensal: 1000, segue_calendario: 0 }],
  fatores,
  lancamentos: [],
});
const [jan, fev, mar, , , , jul, , , , nov, dez] = r.meses;

assert.equal(jan.receita, 0);            // prefeitura não paga em janeiro
assert.equal(fev.receita, 10000);        // metade de fevereiro
assert.equal(jul.receita, 0);
assert.equal(mar.receita, 20000);
assert.equal(jan.despesas, 1000);        // só a despesa fixa (alimentação não segue calendário aqui = 2000*0)
assert.equal(mar.despesas, 3000);
assert.equal(mar.encargos, 240);         // 8% de 3000, ignora inativo
assert.equal(mar.prov13, 270);           // 3000/12 * 1.08
assert.equal(mar.provFerias, 90);        // 3000/3/12 * 1.08
assert.equal(mar.impostos, 1200);
assert.equal(jan.pagtoFerias, 1080);     // 1/3 de 3000 + 8%
assert.equal(nov.pagto13, 1620);         // metade do 13º + 8%
assert.equal(dez.pagto13, 1620);
// Janeiro: sem receita, mas paga folha + fixas + adicional de férias => caixa negativo
assert.equal(jan.saida, 3000 + 500 + 240 + 1000 + 0 + 0 + 1080);
assert.ok(jan.saldo < 0);
assert.ok(r.reservaNecessaria > 0);

// Mês aberto: lançamento comum não altera o caixa; avulso soma ao previsto
const base = {
  escola: { encargos_pct: 8, imposto_pct: 6, saldo_inicial: 0, mes_ferias: 1 },
  funcionarios: [], receitas: [{ valor_mensal: 100, segue_calendario: 0 }], despesas: [{ valor_mensal: 10, categoria: 'Luz', segue_calendario: 0 }], fatores, ano: 2026,
};
let r2 = calcularEscola({ ...base, lancamentos: [
  { data: '2026-03-10', tipo: 'despesa', categoria: 'Luz', valor: 12, avulso: 0 },
  { data: '2026-03-12', tipo: 'despesa', categoria: 'Material de limpeza', valor: 50, avulso: 1 },
] });
assert.equal(r2.meses[2].saida, 10 + 0 + 50 + 0.06 * 100);   // previsto 10 + avulso 50 + imposto 6
assert.deepEqual(r2.categorias.find((c) => c.categoria === 'Luz'), { categoria: 'Luz', previsto: 120, realizado: 12 });

// Mês fechado: caixa usa só o realizado
r2 = calcularEscola({ ...base, fechados: [false, false, true], lancamentos: [{ data: '2026-03-10', tipo: 'receita', valor: 777 }] });
assert.equal(r2.meses[2].entrada, 777);
assert.equal(r2.meses[2].saida, 0);
assert.equal(r2.meses[3].entrada, 100);

// Colaborador só conta nos meses em que está empregado
const r3 = calcularEscola({ ...base, despesas: [], receitas: [], lancamentos: [], funcionarios: [
  { salario: 1000, beneficios: 0, ativo: 0, data_admissao: '2025-01-10', data_desligamento: '2026-03-20' },
  { salario: 2000, beneficios: 0, ativo: 1, data_admissao: '2026-06-01' },
] });
assert.equal(r3.meses[2].salarios, 1000);   // mar: só o desligado (mês do desligamento conta)
assert.equal(r3.meses[3].salarios, 0);      // abr: ninguém
assert.equal(r3.meses[5].salarios, 2000);   // jun: o novo
console.log('ok');
