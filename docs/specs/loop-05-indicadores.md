# Loop 05 — Indicadores e comparativo entre escolas

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 05 · **Tamanho:** S · **Depende de:** Loops 2, 3 e 4
**Arquivos tocados:** `metrics.js` (puro), `server.js`, `public/app.js`

## Objetivo
Painel de saúde do negócio: custo por criança, receita por criança, folha sobre receita, ponto de equilíbrio (quantas crianças pagam as contas), ocupação, inadimplência e comparativo lado a lado entre Novo Mundo e CIC.

## Escopo
**Dentro:**
- Indicadores por escola e consolidado, mês e ano
- Ponto de equilíbrio em número de crianças
- Comparativo Novo Mundo x CIC com o melhor de cada linha destacado
- Série mensal dos 3 indicadores principais

**Fora (explicitamente):**
- Metas e OKRs
- Benchmark contra outras escolas de fora

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Ponto de equilíbrio | Custos fixos ÷ (receita por criança − custo variável por criança); custos variáveis = categorias Alimentação e Material (cozinha/limpeza/pedagógico), usando `budgeted+oneOff` (mesmo critério do DRE, Loop 4) | Fórmula padrão; essas categorias crescem com o número de crianças, o resto não | Confirmada (REFINEMENT) |
| Meses sem repasse | Indicadores anuais usam o ano todo; mensais mostram o mês real | Evita distorcer com janeiro e julho | Confirmada (REFINEMENT) |
| Crianças ativas (denominador) | Contagem de hoje (público + particular), mesmo critério de `occupancy()` do Loop 2 — não uma média mensal | Simples de conferir à mão; uma média exigiria abrir `activeFractionInMonth` por mês em `calc.js`, sem ganho claro | Confirmada (REFINEMENT) |
| Série mensal dos "3 indicadores principais" | **Reduzido a 1**: só a margem mensal (`m.result/m.revenue`), que já existe em `report.months` — sem função nova | Custo/receita por criança por mês exigiria saber quantas crianças estavam ativas em CADA mês, e hoje só sabemos a contagem de hoje; abrir isso é trabalho de `calc.js`, não deste loop | Confirmada (REFINEMENT), corte de escopo |

## Critérios de aceite
- [x] AC1 — Custo por criança = `report.totals.accrualCost ÷ criançasAtivas` e receita por criança = `report.totals.revenue ÷ criançasAtivas`, batendo com conta à mão na demo *(verificar: teste puro + conta manual)*
- [x] AC2 — Ponto de equilíbrio = `custosFixos ÷ (receitaPorCrianca − custoVariavelPorCrianca)`, arredondado para cima; com esse número exato de crianças (multiplicado pela receita e pelo custo variável médios) o resultado fica em zero, e com uma criança a menos fica negativo *(verificar: teste `AC2`, fronteira exata)*
- [x] AC3 — Escola sem nenhuma criança cadastrada devolve `null` (nunca `NaN`/`Infinity`) em custo por criança, receita por criança e ponto de equilíbrio; o front mostra "—" *(verificar: teste `AC3` + navegador)*
- [x] AC4 — Comparativo lado a lado abre em largura de celular sem rolagem horizontal da página, em tema claro e escuro *(verificar: navegador)*
- [x] AC5 — Folha sobre receita = `(salaries+benefits+charges+thirteenthProvision+vacationProvision) ÷ revenue`; com receita zero, devolve `null` *(verificar: teste `AC5`)*
- [x] AC6 — No comparativo, a escola com o melhor valor de cada linha aparece marcada; para "custo por criança" menor é melhor, para as demais maior é melhor *(verificar: teste puro `melhorEscola` + navegador)*

## Notas de design
- `metrics.js` puro: `buildMetrics({ report, activeChildren, capacity })` devolve `{ costPerChild, revenuePerChild, payrollOverRevenue, breakEven, occupancyPct }`, todos `null` quando não computáveis (nunca `NaN`/`Infinity`). `betterSchool(rows, key, direction)` decide qual escola vence uma linha do comparativo.
- Custo variável por criança sai de `report.categories`, somando `budgeted+oneOff` das categorias Alimentação/Material de cozinha/Material de limpeza/Material pedagógico — mesmo padrão do Loop 4.
- Endpoint `GET /api/metrics?year=&school=` monta o relatório (reusa `buildReport`), busca as crianças ativas da(s) escola(s) e chama `buildMetrics`.
- Aba "Indicadores": para uma escola, cartões com os 5 números; para "todas", tabela comparativa Novo Mundo x CIC com o melhor de cada linha marcado, mais o gráfico de margem mensal (linha já existente em `report.months`).

## Configuração
Nenhuma.

## Tarefas
- [x] 1. `metrics.js` puro com testes de fronteira (zero crianças, receita zero, ponto de equilíbrio exato)
- [x] 2. Endpoint `GET /api/metrics`
- [x] 3. Aba "Indicadores": cartões (uma escola) e comparativo (todas)
- [x] 4. Gráfico de margem mensal no comparativo
- [x] 5. `npm run test:api` **completo** (não só o arquivo novo — lição do Loop 4)
- [x] 6. VERIFY com números conferidos à mão

## Registro de acompanhamento
### PLAN        — [ ] explorou o código · [ ] spec rascunhada · [ ] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [x] decisões resolvidas (todas nossas) · [x] suposições conferidas (`occupancy()`/`report.categories` relidos) · [x] ACs testáveis · [x] revisão de DoR → Ready em 2026-09-23
### IMPLEMENT   — [x] tarefas feitas · [x] `node --check` + `npm test` verdes por tarefa · [x] env documentado (nenhuma variável nova) → feito em 2026-09-23
### TEST        — [x] testes nomeados por AC · [x] caminhos negativos · [x] suíte completa (não só o arquivo novo) · suítes: lógica 8/8 arquivos · API 31/31 → verde em 2026-09-23
### VERIFY      — [x] passeio no navegador + capturas (claro/escuro, desktop/celular) · [x] checklist de ACs · [x] sonda hostil (herdada) · [x] regressão · [x] portas na rede · [x] números conferidos à mão → tudo ✅ em 2026-09-23
### DOCUMENT    — [x] Resultado da spec · [x] changelog do ROADMAP · [x] docs vivos → feito em 2026-09-23
### PLAN AGAIN  — [x] retro · [x] carry-overs registrados · [x] roadmap repriorizado (sem mudança) · [x] memória atualizada → próximo loop iniciado em 2026-09-23 (Loop 6)

## Registro de verificação

| AC | Evidência |
|---|---|
| AC1 | ✅ `test-metrics.js` e teste de API "AC1": `costPerChild`/`revenuePerChild` batem exatamente com `report.totals.accrualCost/activeChildren` e `report.totals.revenue/activeChildren` |
| AC2 | ✅ `test-metrics.js`: construí um relatório cujos números dão um N exato; no ponto de equilíbrio o resultado fica ≥ 0, com N−1 fica negativo |
| AC3 | ✅ teste de API "AC3": escola sem crianças devolve `null` em todos os índices, nunca `"NaN"` |
| AC4 | ✅ navegador: comparativo em largura de celular, tema claro e escuro, sem rolagem horizontal da página |
| AC5 | ✅ `test-metrics.js` e teste de API "AC5": folha sobre receita `null` quando a receita é zero |
| AC6 | ✅ `test-metrics.js` (`betterSchool`) e teste de API "AC6": CIC ganhou a estrela em "Folha sobre receita" e "Margem" na demo (53,9% e 9,1%, contra 55,5% e 8,1% do Novo Mundo) |

**Achado no VERIFY, fora do escopo original deste loop:** o filtro "Todas" do topo era substituído em silêncio pela primeira escola em **qualquer** aba que não fosse o Painel — incluindo a nova aba Indicadores e a aba DRE do Loop 4. Isso significa que o comparativo consolidado do DRE (Loop 4, AC1 "para o consolidado") nunca tinha sido de fato alcançável pela tela — só verifiquei aquele AC por `fetch` direto, não clicando. Corrigido: a lista de abas que aceitam "Todas" (`ALLOWS_ALL_SCHOOLS`) agora inclui `dashboard`, `statement` e `metrics`. Reverifiquei o DRE consolidado pela tela depois da correção.

**Os testes detectam regressão?** Quebrei `breakEven` de `Math.ceil` para `Math.floor`; o teste de fronteira exata falhou (5 em vez de 6). Código restaurado, suíte voltou a 8/8.

## Resultado

**Entregou:** `metrics.js` puro (`buildMetrics`, `betterSchool`); endpoint `GET /api/metrics` (uma escola ou consolidado, com comparativo e "vencedor" por linha); aba "Indicadores" com cartões (uma escola) e tabela comparativa + margem mensal (todas). Corrigido um bug de navegação que impedia alcançar a visão consolidada em qualquer aba além do Painel.

**Desvios:**
- Ponto de equilíbrio usa a receita e o custo variável médios por criança (mistura pública/particular), não o valor marginal só das crianças de vaga pública — mais simples e é o que a spec original pedia; o rascunho inicial da REFINEMENT tinha ido por um caminho mais complexo e foi simplificado de volta antes do IMPLEMENT.
- "Série mensal dos 3 indicadores principais" ficou só a margem mensal consolidada — corte de escopo decidido na REFINEMENT (custo/receita por criança por mês exigiria saber quantas crianças estavam ativas em cada mês passado, dado que `calc.js` não guarda).

**Retro:**
- **Ajudou:** o VERIFY pela tela (não só por `curl`) achou um bug real — o filtro "Todas" sendo substituído em silêncio fora do Painel — que a fase TEST (só testes de API, sem navegador) nunca poderia ter achado. É exatamente para isso que a fase VERIFY existe separada da TEST.
- **Atrapalhou:** esse mesmo bug já existia desde antes do Loop 4 e passou pelo VERIFY daquele loop porque testei "consolidado" só por `fetch`, sem clicar no seletor de escola.
- **Mudar no processo:** o checklist de VERIFY já pede "percorrer o fluxo completo... clicar, não só `curl`" — o problema foi eu não ter seguido isso à risca no Loop 4. Não é o processo que precisa mudar, é seguir o que já está escrito.

**Carry-overs:** nenhum novo. O bug do filtro "Todas" foi corrigido neste loop, não adiado.
