import assert from 'node:assert/strict';
import { calcularRescisao } from './rescisao.js';

const v = (r, nome) => r.linhas.find((l) => l.nome === nome)?.valor;

// Sem justa causa: salário 3000, admitido 10/03/2023, saiu 18/09/2026, aviso indenizado, 3 períodos de férias gozados.
// 3 anos completos -> aviso 39 dias -> data projetada 27/10/2026.
let r = calcularRescisao({ salario: 3000, data_admissao: '2023-03-10', data_rescisao: '2026-09-18', tipo: 'sem_justa_causa', ferias_periodos_gozados: 3 });
assert.equal(r.dataProjetada, '2026-10-27');
assert.equal(v(r, 'Saldo de salário'), 1800);                 // 18 dias × 100
assert.equal(v(r, 'Aviso prévio indenizado'), 3900);          // 39 dias × 100
assert.equal(v(r, '13º salário proporcional'), 2500);         // 10/12 (jan..out, out com 27 dias)
assert.equal(v(r, 'Férias vencidas'), undefined);
assert.equal(v(r, 'Férias proporcionais'), 2000);             // 8/12: 7 meses + 17 dias
assert.equal(v(r, '1/3 constitucional sobre férias proporcionais'), 666.67);
assert.equal(r.totalColaborador, 1800 + 3900 + 2500 + 2000 + 666.67);
// FGTS estimado: 42 meses × 3000 × 8% × 13/12 = 10920; depósito rescisório 8% × (1800+3900+2500) = 656
assert.equal(r.fgts.saldoEstimado, 10920);
assert.equal(r.fgts.depositoRescisorio, 656);
assert.equal(r.fgts.multa, 4630.4);                           // 40% × (10920 + 656)
assert.equal(r.custoEscola, r.totalColaborador + 656 + 4630.4);

// Acordo: aviso 50%, multa 20%
r = calcularRescisao({ salario: 3000, data_admissao: '2023-03-10', data_rescisao: '2026-09-18', tipo: 'acordo', ferias_periodos_gozados: 3 });
assert.equal(v(r, 'Aviso prévio indenizado'), 1950);
assert.equal(r.fgts.pctMulta, 0.2);
assert.equal(r.fgts.saqueLiberado, '80%');

// Pedido de demissão: sem aviso indenizado, sem multa; desconto se não cumprir aviso
r = calcularRescisao({ salario: 3000, data_admissao: '2023-03-10', data_rescisao: '2026-09-18', tipo: 'pedido_demissao', ferias_periodos_gozados: 3, aviso_cumprido: false });
assert.equal(v(r, 'Aviso prévio indenizado'), undefined);
assert.equal(v(r, '(−) Desconto de aviso prévio não cumprido'), -3000);
assert.equal(r.fgts.multa, 0);
assert.equal(v(r, '13º salário proporcional'), 2250);         // sem projeção: jan..set (set com 18 dias) = 9/12

// Justa causa: só saldo de salário (e férias vencidas, se houver)
r = calcularRescisao({ salario: 3000, data_admissao: '2023-03-10', data_rescisao: '2026-09-18', tipo: 'justa_causa', ferias_periodos_gozados: 3 });
assert.deepEqual(r.linhas.map((l) => l.nome), ['Saldo de salário']);
assert.equal(r.fgts.multa, 0);

// Férias vencidas e não gozadas há mais de 12 meses -> alerta de dobra
r = calcularRescisao({ salario: 3000, data_admissao: '2023-03-10', data_rescisao: '2026-09-18', tipo: 'justa_causa', ferias_periodos_gozados: 1 });
assert.equal(v(r, 'Férias vencidas'), 6000);                  // 2 períodos vencidos (2024/25 e 2025/26)
assert.ok(r.avisos.some((a) => a.includes('dobro')));

// Primeiro ano: admitido 01/06/2026 (13º conta junho inteiro), sai 20/09/2026 sem justa causa, aviso 30 dias
r = calcularRescisao({ salario: 2400, data_admissao: '2026-06-01', data_rescisao: '2026-09-20', tipo: 'sem_justa_causa' });
assert.equal(r.diasAviso, 30);
assert.equal(r.dataProjetada, '2026-10-20');
assert.equal(v(r, '13º salário proporcional'), 1000);         // jun..out = 5/12 × 2400
assert.equal(v(r, 'Férias proporcionais'), 1000);             // 4 meses + 19 dias -> 5/12
assert.equal(v(r, 'Férias vencidas'), undefined);

// Teto de 90 dias de aviso (20 anos de casa)
r = calcularRescisao({ salario: 3000, data_admissao: '2005-01-05', data_rescisao: '2026-09-18', tipo: 'sem_justa_causa', ferias_periodos_gozados: 21 });
assert.equal(r.diasAviso, 90);

assert.throws(() => calcularRescisao({ salario: 1, data_admissao: '2026-05-01', data_rescisao: '2026-04-01', tipo: 'acordo' }));
console.log('ok rescisao');
