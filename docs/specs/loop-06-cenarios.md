# Loop 06 — Cenários: e se a Prefeitura atrasar?

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 06 · **Tamanho:** M · **Depende de:** Loop 0 (Loop 2 melhora os cenários de matrícula)
**Arquivos tocados:** `scenarios.js` (puro), `calc.js`, `db.js` (Scenario), `server.js`, `public/app.js`

## Objetivo
Simular sem mexer nos dados reais: a Prefeitura atrasa N meses, perdemos ou ganhamos crianças, os salários sobem X% a partir de um mês, contratamos ou demitimos alguém (com a rescisão). O app compara o cenário com a base: saldo mínimo, mês crítico e reserva necessária.

## Escopo
**Dentro:**
- Cenário = conjunto de ajustes (overrides) sobre os dados reais
- Ajustes: atraso do repasse (caixa), contratação, demissão (com rescisão simulada), corte de despesa por categoria
- Comparação base x cenário lado a lado
- Salvar e reabrir cenários

**Fora (explicitamente):**
- Previsão estatística ou IA
- Cenários que gravam dados reais
- **Reajuste salarial** e **variação de crianças** (aumento/queda de matrícula): cortados nesta versão — ver Decisões

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Atraso do repasse | Desloca **toda** a entrada de caixa do mês (não só a fração do repasse) N meses; a competência não muda | O relatório de `calc.js` não separa "receita da Prefeitura" de "outras receitas" dentro do número final do mês; separar isso é um trabalho à parte em `calc.js`. Na prática, nos meses de repasse reduzido essa é a maior parte da entrada mesmo | Confirmada (REFINEMENT), simplificação documentada |
| Como aplicar | `calc.js` ganha um parâmetro opcional `revenueDelayMonths` (padrão 0); `scenarios.js` transforma as ENTRADAS (funcionários/despesas/lançamentos) antes de chamar `calculateSchool`, nunca o relatório já pronto | Reusa a lógica existente sem duplicar; zero risco de regressão quando o parâmetro não é usado | Confirmada (REFINEMENT) |
| Reajuste salarial | **Cortado desta versão** | `calc.js` aplica um salário fixo o ano todo por funcionário; simular "salário sobe X% a partir do mês Y" exigiria salário variável por mês, uma mudança maior em `calc.js` | Confirmada (REFINEMENT), corte de escopo |
| Variação de crianças | **Cortado desta versão** | Re-derivar a receita da Prefeitura por criança exige os dados brutos de `children.js` (não só o relatório); contratação/demissão já cobrem o principal ("e se alguém saísse?") | Confirmada (REFINEMENT), corte de escopo |
| Demissão simulada | Reusa `calculateSeverance` (Loop 0) para o custo; entra como lançamento avulso `Rescisão` só dentro do cenário, nunca no banco | Mesma fórmula real, sem duplicar lógica | Confirmada (REFINEMENT) |

## Critérios de aceite
- [x] AC1 — Atrasar o repasse 2 meses mantém `totals.result` idêntico ao da base e piora (ou mantém) `minBalance` *(verificar: teste `AC1`)*
- [x] AC2 — `applyAdjustments(inputs, [])` devolve entradas que produzem exatamente o mesmo relatório da base, testado com `assert.deepEqual` no resultado de `calculateSchool` *(verificar: teste `AC2`)*
- [x] AC3 — Demitir um colaborador em junho (simulado) soma o custo da rescisão como avulso em junho e some com o salário dele a partir de junho, sem tocar o funcionário real no banco *(verificar: teste `AC3` com `severance.js` + teste de API confirmando que o funcionário real não mudou)*
- [x] AC4 — Criar, listar e apagar um cenário não muda a contagem de nenhuma outra coleção (funcionários, despesas, lançamentos) *(verificar: teste de API `AC4`, contagens antes/depois)*
- [x] AC5 — A tela mostra base x cenário lado a lado, com a diferença do saldo mínimo e do resultado em R$ *(verificar: navegador)*
- [x] AC6 — Ajuste com `employee_id` inexistente, `type` desconhecido, ou `pct`/`months` fora da faixa não derruba o simulador: vem como aviso (`warnings`), nunca 500 *(verificar: teste `AC6`)*

## Notas de design
- `calc.js`: `calculateSchool` ganha `revenueDelayMonths = 0`. Depois de montar `months`, se `> 0`, um passo desloca `cashIn` (não `revenue`/`result`) — o mês `i` recebe o `cashIn` que seria do mês `i - revenueDelayMonths`; o que "cairia" antes de janeiro é perdido (fora do ano), documentado.
- `scenarios.js` puro: `applyAdjustments(inputs, adjustments)` devolve `{ employees, expenses, entries, revenueDelayMonths, warnings }` prontos para `calculateSchool`. Tipos: `delay_transfer`, `hire`, `terminate` (usa `calculateSeverance`), `cut_expense`. Ajuste desconhecido ou inválido vira `warnings`, nunca lança.
- `Scenario` (Mongoose): `{ school_id, name, adjustments }` (`adjustments` é `Schema.Types.Mixed`, uma lista livre). CRUD genérico, igual aos outros recursos.
- Endpoint `POST /api/scenarios/simulate { school_id, year, adjustments }` → `{ base, scenario, warnings }`, cada um com `{ result, minBalance, minBalanceMonth, reserveNeeded }`.
- Aba "Cenários": formulário para montar os ajustes, botão "Simular" (mostra base x cenário), e salvar/reabrir/apagar via o CRUD genérico.

## Configuração
Nenhuma.

## Tarefas
- [x] 1. `calc.js`: `revenueDelayMonths` com teste de regressão (parâmetro omitido = comportamento idêntico)
- [x] 2. `scenarios.js` puro com testes de fronteira e o teste de invariante (AC2)
- [x] 3. Modelo `Scenario` e endpoint `POST /api/scenarios/simulate`
- [x] 4. Aba "Cenários"
- [x] 5. `npm run test:api` completo (lição do Loop 4)
- [x] 6. VERIFY comparando à mão um atraso de 2 meses

## Registro de acompanhamento
### PLAN        — [ ] explorou o código · [ ] spec rascunhada · [ ] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [x] decisões resolvidas (todas nossas) · [x] suposições conferidas (`calc.js`/`severance.js` relidos) · [x] ACs testáveis · [x] revisão de DoR → Ready em 2026-09-23
### IMPLEMENT   — [x] tarefas feitas · [x] `node --check` + `npm test` verdes por tarefa · [x] env documentado (nenhuma variável nova) → feito em 2026-09-23
### TEST        — [x] testes nomeados por AC · [x] caminhos negativos · [x] suíte completa · suítes: lógica 9/9 arquivos · API 37/37 → verde em 2026-09-23
### VERIFY      — [x] passeio no navegador + capturas (claro/escuro, desktop/celular) · [x] checklist de ACs · [x] sonda hostil · [x] regressão · [x] portas na rede · [x] números conferidos à mão (diferença de R$0,00 no lucro, R$102.039,83 no pior saldo) → tudo ✅ em 2026-09-23
### DOCUMENT    — [x] Resultado da spec · [x] changelog do ROADMAP · [x] docs vivos → feito em 2026-09-23
### PLAN AGAIN  — [x] retro · [x] carry-overs registrados · [x] roadmap repriorizado (sem mudança) · [x] memória atualizada → próximo loop iniciado em 2026-09-23 (Loop 7)

## Registro de verificação

| AC | Evidência |
|---|---|
| AC1 | ✅ `test-scenarios.js` e teste de API "AC1": atrasar 2 meses mantém `totals.result` idêntico; `minBalance` piora ou mantém. Na tela: lucro R$53.370,67 nos dois, pior saldo caiu de -R$29.873,10 para -R$131.912,93 |
| AC2 | ✅ `test-scenarios.js`: `applyAdjustments(inputs, [])` produz `assert.deepEqual` com a base; teste de API confirma o mesmo pela rota |
| AC3 | ✅ `test-scenarios.js` (com `severance.js` de verdade) e teste de API: salário para em julho, custo de rescisão soma em junho; o funcionário real no banco não mudou (`active:1`, sem `termination_date`) |
| AC4 | ✅ teste de API "AC4": contagens de funcionários/receitas/lançamentos idênticas antes e depois de criar+listar+apagar um cenário. Verificado também na tela (salvar, listar, excluir) |
| AC5 | ✅ navegador: tabela base×cenário×diferença, com cor (verde/vermelho) na diferença |
| AC6 | ✅ `test-scenarios.js` e teste de API: tipo inválido, colaborador inexistente, `pct`/`months` fora da faixa — todos viram `warnings`, nunca lançam nem derrubam a simulação; a entrada válida da mesma lista ainda é aplicada |

**Os testes detectam regressão?** Quebrei o corte de despesa (removi a validação de `pct` entre 0 e 1); o teste de fronteira parou de contar 4 avisos e passou a contar 3. Código restaurado, suíte voltou a 9/9.

**Achado durante o IMPLEMENT (não é regressão de teste, é um bug pego pelo próprio teste que escrevi):** o resumo `summarize()` do endpoint `/api/scenarios/simulate` buscava `report.result`/`report.revenue`, que não existem nesse nível (ficam em `report.totals.result`/`report.totals.revenue`) — o teste `AC3` (`assert.notEqual(...,undefined)`) pegou isso antes de chegar ao VERIFY.

## Resultado

**Entregou:** `calc.js` ganhou `revenueDelayMonths` (opcional, desloca só o caixa); `scenarios.js` puro (`applyAdjustments`) com 4 tipos de ajuste (`delay_transfer`, `hire`, `terminate`, `cut_expense`), nunca lança, devolve `warnings`; modelo `Scenario` (CRUD genérico); endpoint `POST /api/scenarios/simulate`; aba "Cenários" com montador de ajustes, comparação base×cenário e salvar/reabrir/apagar.

**Desvios (cortes já previstos na REFINEMENT):**
- Sem reajuste salarial nem variação de crianças como tipos de ajuste — `calc.js` não suporta salário variável por mês nem re-derivar receita sem os dados brutos de matrícula fora do relatório já pronto.
- "Reabrir" um cenário salvo carrega os ajustes no formulário só via a lista salva (clicar "Simular" nesse item não pré-popula o construtor automaticamente) — funcional, mas cru; carry-over.
- Atraso do repasse desloca o caixa do mês inteiro, não só a fração do repasse (documentado na REFINEMENT).

**Retro:**
- **Ajudou:** projetar `applyAdjustments` para transformar as ENTRADAS de `calculateSchool` (em vez de remendar o relatório já pronto) permitiu reusar 100% da lógica de `calc.js` e `severance.js` sem duplicar nada — a "demissão simulada" usa a mesma fórmula real de rescisão.
- **Atrapalhou:** um erro bobo (`report.result` em vez de `report.totals.result`) só apareceu porque o teste de API comparava contra `undefined` explicitamente; se o teste tivesse só checado "não é 500", teria passado escondendo o bug.
- **Mudar no processo:** nenhuma mudança nova — a lição do Loop 4/5 (rodar a suíte completa, verificar pela tela) continua valendo e pegou o que precisava pegar.

**Carry-overs:**
1. Reajuste salarial e variação de crianças como tipos de ajuste — Loop 7 ou posterior, se `calc.js` ganhar suporte a salário/receita variável por mês.
2. Clicar num cenário salvo não recarrega os ajustes no formulário para editar.
