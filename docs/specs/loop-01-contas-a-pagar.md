# Loop 01 — Contas a pagar: vencimento, baixa e fornecedores

**Status:** Draft
**Roadmap:** [ROADMAP.md](../ROADMAP.md) §Loop 01 · **Tamanho:** M · **Depende de:** Loop 0
**Arquivos tocados:** `db.js` (Conta, Fornecedor), `server.js`, `contas.js` (puro), `public/app.js`, `test/`

## Objetivo
Cada conta (água, luz, internet, segurança, fornecedores, compras) tem vencimento e status pendente/vencida/paga. Marcar como paga lança o realizado sozinho e alimenta o previsto x realizado. O Painel mostra o que vence nos próximos dias.

## Escopo
**Dentro:**
- Fornecedores (nome, documento, contato)
- Conta: escola, fornecedor, descrição, categoria, competência, vencimento, valor, pago em, valor pago
- Gerar as contas do mês a partir das despesas recorrentes (idempotente)
- Baixa (pagar) que cria o lançamento realizado ligado à conta
- Dividir uma conta entre as escolas (reusa `rateio.js`)
- Aba "Contas a pagar" com filtros e cartão "vence em 7 dias" no Painel

**Fora (explicitamente):**
- Pagamento pela internet ou integração com banco
- Juros e multa por atraso
- Leitura de código de barras

## Decisões
Status **Proposta** = recomendação nossa, confirmar na REFINEMENT. **ABERTA** = precisa do dono antes de virar `Ready`.

| Decisão | Escolha | Por quê | Status |
|---|---|---|---|
| Status vencida | Derivado (`vencimento < hoje` e sem baixa), não gravado | Evita status desatualizado | Proposta |
| Baixa e lançamento | Baixa cria `Lancamento` com `conta_id`; desfazer baixa apaga o lançamento | Um só lugar de verdade para o realizado | Proposta |
| Valor pago diferente do previsto | Permitido | Contas reais variam (luz, juros) | Proposta |
| Fuso | Datas como texto `YYYY-MM-DD`, "hoje" pelo fuso America/Sao_Paulo | Mesmo padrão dos lançamentos; evita conta vencer um dia antes | Proposta |

## Critérios de aceite
- [ ] AC1 — "Gerar contas de outubro" cria uma conta por despesa recorrente; rodar de novo não duplica *(verificar: teste `AC1`)*
- [ ] AC2 — Conta com vencimento ontem e sem baixa aparece como vencida; paga aparece como paga *(verificar: teste puro de `statusConta` + navegador)*
- [ ] AC3 — Pagar uma conta cria 1 lançamento com o valor pago; desfazer a baixa remove esse lançamento *(verificar: teste `AC3`)*
- [ ] AC4 — Pagar com valor diferente do previsto atualiza a linha da categoria em "Despesas por categoria" *(verificar: navegador + relatório)*
- [ ] AC5 — Conta de R$ 480,00 dividida entre as escolas gera duas contas ligadas, ao pagar uma a outra segue pendente *(verificar: teste `AC5`)*
- [ ] AC6 — O cartão do Painel lista contas dos próximos 7 dias e as vencidas, com total *(verificar: navegador com dados da demo)*
- [ ] AC7 — Valor negativo, vencimento inválido e fornecedor inexistente devolvem 400 *(verificar: teste `AC7`)*

## Notas de design
- Modelo `Conta`: `escola_id, fornecedor_id, despesa_id, descricao, categoria, competencia (YYYY-MM), vencimento, valor, pago_em, valor_pago, grupo_id`.
- `contas.js` puro: `statusConta(conta, hoje)`, `gerarContasDoMes(despesas, competencia, existentes)`.
- Endpoints: CRUD genérico + `POST /api/contas/gerar`, `POST /api/contas/:id/pagar`, `POST /api/contas/:id/desfazer`.
- Reusar `formDividir()` do front.

## Configuração
Nenhuma.

## Tarefas
- [ ] 1. Modelos Fornecedor e Conta
- [ ] 2. `contas.js` puro com testes
- [ ] 3. Endpoints gerar/pagar/desfazer
- [ ] 4. Aba "Contas a pagar" e cadastro de fornecedores
- [ ] 5. Cartão de vencimentos no Painel
- [ ] 6. Divisão de conta entre escolas
- [ ] 7. Testes de API e passeio de VERIFY

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
