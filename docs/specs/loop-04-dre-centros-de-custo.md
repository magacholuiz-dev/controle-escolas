# Loop 04 — Plano de contas, centros de custo e DRE

**Status:** Draft
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 04 · **Tamanho:** M · **Depende de:** Loop 1 (Loop 2 opcional para turma)
**Arquivos tocados:** `plano.js` (puro), `calc.js`, `server.js`, `public/app.js`

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
| Grupos do DRE | Receita bruta · Deduções (impostos) · Pessoal · Operacional · Administrativo | Enxuto e comum em escolas | Proposta |
| Regime de apuração | Competência, como o lucro atual | Consistente com o Painel | Proposta |

## Critérios de aceite
- [ ] AC1 — O resultado anual do DRE consolidado é igual a `totais.resultado` do relatório *(verificar: teste de invariante `AC1`)*
- [ ] AC2 — Mover "Segurança" de grupo muda o DRE e não muda o lucro *(verificar: teste `AC2`)*
- [ ] AC3 — DRE por escola mostra a mesma receita que a aba Receitas prevê *(verificar: navegador)*
- [ ] AC4 — Custo comum dividido 60/40 aparece nas duas escolas com os percentuais certos *(verificar: teste `AC4`)*
- [ ] AC5 — Categoria sem grupo cai em "Não classificado" e avisa *(verificar: teste `AC5`)*

## Notas de design
- `plano.js` puro: `montarDRE(relatorio, mapa)`. Mapa padrão como constante, sobrescrevível por escola.
- Nova aba "DRE" com tabela mensal e coluna do ano; reusa o componente de tabela do Painel.

## Configuração
Nenhuma.

## Tarefas
- [ ] 1. Mapa padrão e `montarDRE` com teste de invariante
- [ ] 2. Endpoint e aba DRE
- [ ] 3. Edição do mapa
- [ ] 4. Rateio de administração comum
- [ ] 5. VERIFY comparando com o Painel

## Registro de acompanhamento
### PLAN        — [ ] explorou o código · [ ] spec rascunhada · [ ] decisões listadas → Draft em 2026-09-21
### REFINEMENT  — [ ] decisões resolvidas · [ ] suposições conferidas · [ ] ACs testáveis · [ ] revisão de DoR → Ready em ____
### IMPLEMENT   — [ ] tarefas feitas · [ ] `node --check` + `npm test` verdes por tarefa · [ ] env documentado → feito em ____
### TEST        — [ ] testes nomeados por AC · [ ] caminhos negativos · suítes: lógica _/_ · API _/_ → verde em ____
### VERIFY      — [ ] passeio no navegador + capturas · [ ] checklist de ACs · [ ] sonda hostil · [ ] regressão · [ ] números conferidos à mão → tudo ✅ em ____
### DOCUMENT    — [ ] Resultado da spec · [ ] changelog do ROADMAP · [ ] docs vivos → feito em ____
### PLAN AGAIN  — [ ] retro · [ ] carry-overs registrados · [ ] roadmap repriorizado · [ ] memória atualizada → próximo loop iniciado em ____

## Registro de verificação
_Preenchido na fase VERIFY: AC → evidência (nome do teste, captura de tela, saída do curl)._

## Resultado
_Preenchido na fase DOCUMENT: o que entregou, desvios, retro (3 linhas), carry-overs._
