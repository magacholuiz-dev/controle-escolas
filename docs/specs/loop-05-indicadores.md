# Loop 05 — Indicadores e comparativo entre escolas

**Status:** Draft
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 05 · **Tamanho:** S · **Depende de:** Loops 2, 3 e 4
**Arquivos tocados:** `indicadores.js` (puro), `server.js`, `public/app.js`

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
| Ponto de equilíbrio | Custos fixos ÷ (receita por criança − custo variável por criança) | Fórmula padrão; custo variável = alimentação e material | Proposta |
| Meses sem repasse | Indicadores anuais usam o ano todo; mensais mostram o mês real | Evita distorcer com janeiro e julho | Proposta |

## Critérios de aceite
- [ ] AC1 — Custo por criança = custos do período ÷ crianças ativas, batendo com conta à mão em uma escola da demo *(verificar: teste puro + conta manual)*
- [ ] AC2 — Ponto de equilíbrio devolve N inteiro e, com N crianças, o resultado mensal fica ≥ 0 *(verificar: teste `AC2`)*
- [ ] AC3 — Escola sem crianças cadastradas mostra "—" e não NaN/Infinity *(verificar: teste `AC3`)*
- [ ] AC4 — Comparativo lado a lado abre em largura de celular sem rolagem horizontal da página *(verificar: navegador)*

## Notas de design
- `indicadores.js` puro recebe o relatório + crianças + mensalidades e devolve objeto de indicadores.
- Gráfico de série reusa `base()` de `public/app.js`.

## Configuração
Nenhuma.

## Tarefas
- [ ] 1. Funções puras com testes (divisão por zero, mês sem repasse)
- [ ] 2. Endpoint `/api/indicadores`
- [ ] 3. Aba "Indicadores" com comparativo
- [ ] 4. VERIFY com números conferidos à mão

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
