# Loop 04 — Plano de contas, centros de custo e DRE

**Status:** Done
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 04 · **Tamanho:** M · **Depende de:** Loop 1 (Loop 2 opcional para turma)
**Arquivos tocados:** `statement.js` (puro), `calc.js`, `server.js`, `public/app.js`

## Objetivo
Cada categoria pertence a um grupo do DRE (receita, deduções, pessoal, operacional, administrativo). O app mostra o DRE mensal e anual por escola e consolidado, previsto x realizado, e cada custo comum (segurança, contabilidade) vai para o centro de custo certo.

## Escopo
**Dentro:**
- Mapa categoria → grupo do DRE, editável
- DRE mensal/anual por escola e consolidado
- Previsto x realizado por grupo
- Centro de custo "Administração comum" com rateio para as escolas
- Invariante: o resultado do DRE é igual ao lucro do Painel

**Fora (explicitamente):**
- Contabilidade fiscal, SPED, balanço
- Turma como centro de custo (só se o Loop 2 trouxer o modelo Turma)

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Grupos do DRE | Receita bruta · Deduções (impostos) · Pessoal · Operacional · Administrativo · Não classificado | Enxuto e comum em escolas | Confirmada (REFINEMENT) |
| Regime de apuração | Competência, como o lucro atual | Consistente com o Painel | Confirmada (REFINEMENT) |
| Quanto de cada categoria entra no DRE | `previsto` (despesa recorrente, já multiplicada pelo fator) + só a parte `avulsa` do realizado — nunca o realizado inteiro | É exatamente o que `calc.js` usa para calcular o lucro (`accrualCost`); usar o realizado inteiro devolveria um DRE que não bate com o Painel quando há lançamentos de acompanhamento (não avulsos) numa categoria | Confirmada (REFINEMENT) |
| DRE mensal (12 colunas) | **Cortado deste loop**: só anual, por escola e consolidado | `calc.js` hoje soma categorias no ano todo, sem quebra por mês; abrir essa quebra é um trabalho de `calc.js` à parte, sem ganho claro para o dono agora | Confirmada (REFINEMENT), corte de escopo |
| Rescisão entra em qual grupo | "Pessoal" (é custo de pessoal, mesmo sendo avulso) | Mais correto que cair em "Operacional"/"Administrativo" por padrão | Confirmada (REFINEMENT) |
| Rateio de administração comum | Reusa o `POST /api/split` do Loop 1 (sem endpoint novo) | Já existe e já é testado; o loop só precisa mostrar o resultado dividido corretamente no DRE | Confirmada (REFINEMENT) |

## Critérios de aceite
- [x] AC1 — O resultado do DRE (soma de todos os grupos) é **exatamente igual** a `report.totals.result`, para uma escola e para o consolidado *(verificar: teste `AC1`, com `assert.equal` sem tolerância)*
- [x] AC2 — Mover a categoria "Segurança" de Administrativo para Operacional muda o valor dos dois grupos, mas o resultado total do DRE não muda um centavo *(verificar: teste `AC2`)*
- [x] AC3 — A linha "Receita bruta" do DRE é igual a `report.totals.revenue`, que já é a mesma receita mostrada no Painel e na aba Receitas *(verificar: teste `AC3`)*
- [x] AC4 — Uma despesa dividida 60/40 entre as escolas (via `POST /api/split`, já existente) aparece no DRE de cada escola com o valor da sua parte, e a soma das duas partes bate com o total original *(verificar: teste `AC4`)*
- [x] AC5 — Uma categoria fora do mapa (ex.: "Outros" ou uma nova, digitada pelo usuário) cai no grupo "Não classificado" e a resposta da API lista essa categoria em `unclassified`, para o front avisar *(verificar: teste `AC5`)*
- [x] AC6 — Um lançamento de despesa comum (não avulso) numa categoria não entra duas vezes no DRE nem falta: o DRE usa `previsto + avulso`, igual ao Painel, nunca o `realizado` inteiro *(verificar: teste `AC6`, cobre a decisão da REFINEMENT sobre o que entra no DRE)*

## Notas de design
- `calc.js` ganha um terceiro campo por categoria, `oneOff` (soma dos lançamentos avulsos daquela categoria), ao lado de `budgeted`/`actual` que já existem. `consolidate()` soma `oneOff` também. Isso é o que faz o DRE bater exatamente com o lucro: `budgeted + oneOff` é a mesma conta que `calc.js` já usa internamente para compor `accrualCost`.
- `statement.js` puro: `buildStatement(report, categoryGroups = DEFAULT_CATEGORY_GROUPS)` devolve `{ groups: [{group, amount}], result, unclassified }`. `DEFAULT_CATEGORY_GROUPS` é uma constante (categoria → grupo, ambos em português, mesmo padrão de `CATEGORIES` no front).
- Endpoint `GET /api/statement?year=&school=` chama `buildReport` e depois `buildStatement`.
- Nova aba "DRE": tabela de grupos (ano), aviso se houver `unclassified`, e um link para a categoria não mapeada ajustar em Configurações (mapa fica em memória do servidor por enquanto — ver Decisões/Config).

## Configuração
Nenhuma variável de ambiente. O mapa categoria→grupo é uma constante no código (`DEFAULT_CATEGORY_GROUPS`); editar o mapa por escola fica fora deste loop (carry-over) — hoje é global para o app.

## Tarefas
- [x] 1. `calc.js`: campo `oneOff` por categoria (mensal e no `consolidate`)
- [x] 2. `statement.js` puro com testes de fronteira e o teste de invariante
- [x] 3. Endpoint `GET /api/statement`
- [x] 4. Aba "DRE" (sem edição do mapa nesta versão — carry-over)
- [x] 5. Teste de API cobrindo o rateio 60/40 (reusa `/api/split`)
- [x] 6. VERIFY comparando com o Painel

## Registro de acompanhamento
### PLAN        — [ ] explorou o código · [ ] spec rascunhada · [ ] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [x] decisões resolvidas (todas nossas, sem pendência do dono) · [x] suposições conferidas (fórmula do `accrualCost` relida em `calc.js`) · [x] ACs testáveis · [x] revisão de DoR → Ready em 2026-09-23
### IMPLEMENT   — [x] tarefas feitas · [x] `node --check` + `npm test` verdes por tarefa · [x] env documentado (nenhuma variável nova) → feito em 2026-09-23
### TEST        — [x] testes nomeados por AC · [x] caminhos negativos · suítes: lógica 7/7 arquivos · API 26/26 → verde em 2026-09-23
### VERIFY      — [x] passeio no navegador + capturas (claro/escuro, desktop/celular) · [x] checklist de ACs · [x] sonda hostil (herdada dos endpoints existentes) · [x] regressão · [x] portas na rede · [x] números conferidos à mão (DRE = Painel, R$53.370,67) → tudo ✅ em 2026-09-23
### DOCUMENT    — [x] Resultado da spec · [x] changelog do ROADMAP · [x] docs vivos → feito em 2026-09-23
### PLAN AGAIN  — [x] retro · [x] carry-overs registrados · [x] roadmap repriorizado (sem mudança) · [x] memória atualizada → próximo loop iniciado em 2026-09-23 (Loop 5)

## Registro de verificação

| AC | Evidência |
|---|---|
| AC1 | ✅ `test-statement.js` e teste de API "AC1 e AC3": `buildStatement(report).result === report.totals.result`, exato, para uma escola e para o consolidado (por código e via `fetch` direto). Na demo, pela **tela**: Painel mostrou R$53.370,67 de lucro, DRE mostrou R$53.370,67 de resultado, para uma escola específica — o caso consolidado só foi clicado na tela no Loop 5, depois de corrigir um bug de navegação que impedia chegar lá pelo seletor "Todas" (ver retro do Loop 5) |
| AC2 | ✅ `test-statement.js`: mover "Segurança" de Administrativo para Operacional muda os dois grupos e o resultado total não muda |
| AC3 | ✅ mesmo teste: a linha "Receita bruta" é exatamente `report.totals.revenue` |
| AC4 | ✅ teste de API "AC4": despesa dividida 60/40 via `/api/split` (já existente do Loop 1); as duas partes somam de volta ao valor original, e o resultado do DRE de cada escola bate com o relatório de cada escola |
| AC5 | ✅ teste de API "AC5": categoria "Outros" (fora do mapa) cai em `unclassified` e no grupo "Não classificado" |
| AC6 | ✅ `test-statement.js` e teste de API "AC6": um lançamento de acompanhamento (não avulso) na mesma categoria de uma despesa recorrente não muda o resultado do DRE, provando que `budgeted+oneOff` (não o `actual` inteiro) é o que entra na conta |

**Os testes detectam regressão?** Troquei `budgeted+oneOff` por `actual` inteiro em `statement.js`; o teste de invariante falhou imediatamente (R$173.400 em vez de R$153.000 esperado). Código restaurado, suíte voltou a 7/7.

**Achado durante TEST/VERIFY (fora do escopo do Loop 4):** o teste de API "AC6: painel de vencimentos" do Loop 1 (`bills.test.js`) tinha uma data especial hard-coded (`hoje === '2026-09-22'`) que só funcionava no dia em que foi escrito; falhou sozinho quando a suíte completa rodou em 2026-09-23. Corrigido para usar "ontem" relativo, sem depender do dia do calendário.

## Resultado

**Entregou:** `statement.js` puro (`buildStatement`), com mapa fixo categoria→grupo (`DEFAULT_CATEGORY_GROUPS`); `calc.js` ganhou o campo `oneOff` por categoria (mensal e no `consolidate`), que é exatamente o que faz o DRE bater com o lucro sem tolerância; endpoint `GET /api/statement`; aba "DRE" no front, com aviso de categorias não classificadas.

**Desvios (todos cortes de escopo já previstos na REFINEMENT):**
- Sem DRE mensal (12 colunas), só anual — decisão registrada, exigiria reescrever `calc.js` para guardar categorias por mês.
- Sem edição do mapa categoria→grupo pela tela — é uma constante global no código.
- "Rateio de administração comum" não ganhou nada novo: reusa o `/api/split` do Loop 1, só testado aqui no contexto do DRE (AC4).

**Retro:**
- **Ajudou:** ler `calc.js` com atenção antes de codificar mostrou que o jeito certo de bater com o Painel era um campo novo (`oneOff`) em vez de reconstruir a conta na mão em `statement.js` — evitou duplicar lógica que já existia.
- **Atrapalhou:** rodar a suíte completa (não só os arquivos novos) expôs um teste do Loop 1 que dependia da data do dia em que foi escrito e falhou sozinho um dia depois. Nada a ver com este loop, mas quase passou batido.
- **Mudar no processo:** a fase TEST deste loop rodou só os testes novos antes do DOCUMENT; a partir de agora, sempre rodar `npm run test:api` completo (não só o arquivo novo) antes de marcar TEST como verde — é a única forma de pegar esse tipo de regressão que não tem nada a ver com o código do loop atual.

**Carry-overs:** ver linhas 16–18 do ROADMAP (mapa do DRE não editável por escola; sem DRE mensal; lição sobre datas fixas em teste).
